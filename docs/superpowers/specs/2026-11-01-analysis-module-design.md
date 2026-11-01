# Analysis module (portable core) — design

Date: 2026-11-01
Status: approved in chat, awaiting written-spec review
Branch: `refactor/analysis-module` (cut from `feat/cardio-exercises`, which is not yet on `main`)

## Goal

Move all "training data in → insight out" logic into one self-contained module, `src/analysis/`,
behind a narrow, serializable contract, so it can later run on a backend with little more than a
file move and a new client implementation. No backend, HTTP client or API is built now.

### Context

- The engines are already pure: `src/analyzer/`, `src/recommend/` and `src/program/` never touch
  Dexie, React or browser globals.
- Orchestration is not. `db/analyzeRepo.ts`, `db/analysisRepo.ts`, `db/progressRepo.ts` and
  `db/planVsActualRepo.ts` each read IndexedDB and settings and compose several engines in the same
  function (e.g. `getAnalyzeView`: analyze → previous week → suggestions → summary).
- Engines import row types (`Session`, `SetRow`, `CardioEntry`, `CardioIntensity`, ...) from
  `@/db/types`, and `config/training.ts` imports `CardioIntensity` from there, so the dependency
  arrow points from domain to persistence.

### Success criteria

- Every analysis feature is reachable through one `AnalysisClient` interface; hooks call only it.
- Each feature is a pure query `(input: AnalysisInput, args) → result`, testable without Dexie.
- `AnalysisInput` and every result type are JSON-serializable (no `Map`, `Set`, `Date`, functions).
- ESLint fails if the portable core imports `@/db`, UI code, React or Dexie.
- User-visible behaviour is unchanged: all existing unit and e2e tests pass with unchanged
  assertions.

## Decisions (from brainstorming)

| Topic           | Decision                                                                          |
| --------------- | --------------------------------------------------------------------------------- |
| Backend trigger | None yet — make both "server owns data" and "client posts snapshot" cheap later   |
| Scope           | All four features: Analyze page, exercise insight/swaps, progress, plan vs actual |
| Approach        | Pure module + `AnalysisClient` interface + `LocalAnalysisClient` (no workspace)   |
| Boundary        | Enforced by ESLint `no-restricted-imports`, not by a separate package             |
| Program editor  | `getPlanCheck` / `getProgramAlternatives` stay in `programsRepo` (out of scope)   |

## 1. Layout and dependency rules

```
src/analysis/
  index.ts            public API: types, queries, AnalysisClient, cardio/format helpers
  types.ts            AnalysisInput, view/result types, row types moved from db/types
  client.ts           AnalysisClient interface (no implementation)
  targets.ts          resolveTargets (moved from db/settingsRepo)
  engine/             today's src/analyzer/* (moved, contents unchanged apart from imports)
  recommend/          today's src/recommend/* (moved, contents unchanged apart from imports)
  queries/
    analyzeView.ts    analyzeView, analysis
    exerciseInsight.ts
    alternatives.ts
    progress.ts       deloadSignal, exerciseDeloadHint, longTrend, e1rmHistory
    planVsActual.ts
src/db/localAnalysisClient.ts   loadAnalysisInput + LocalAnalysisClient
```

**Portable core** = `src/analysis/`, `src/program/`, `src/data/`, `src/config/training.ts`,
`src/lib/units.ts`, `src/lib/weight.ts`. These are the only modules `src/analysis/` may import.
All are already free of browser and persistence code.

**Lint rule.** An ESLint override on the portable-core files forbids imports of `@/db`, `@/db/*`,
`@/components/*`, `@/pages/*`, `@/hooks/*`, `react`, `dexie` and `dexie-react-hooks`.

**Moves required by the rule:**

- `Session`, `SessionExercise`, `SetRow`, `CardioEntry`, `CardioIntensity` (and any other row type
  the engines use) move to `analysis/types.ts`; `db/types.ts` re-exports them so persistence code is
  untouched.
- `config/training.ts` imports `CardioIntensity` from `@/analysis/types` instead of `@/db/types`.
- `src/program/` stays in place (it also serves program editing) and imports `@/analysis` instead of
  `@/analyzer`. Its test file imports of `@/analyzer/fixtures` move to `@/analysis/engine/fixtures`.
- `src/analyzer/` and `src/recommend/` are removed after the move; no compatibility re-export.
- UI and `db/` imports of `@/analyzer`, `@/analyzer/*`, `@/recommend` are rewritten to
  `@/analysis`. Deep imports (`@/analyzer/cardio`, `@/analyzer/types`) go through the public index.
  Test-only fixtures are imported from `@/analysis/engine/fixtures`.

**Stays outside the module:** `components/analyze/analyzeModel.ts`, `muscleSort.ts`,
`statusStyle.ts` (display formatting), and `dismissDeload` (a write; stays in `db/progressRepo.ts`).

## 2. Contract

### `AnalysisInput`

```ts
interface AnalysisInput {
  /** sessions, sessionExercises, sets, cardioEntries, exercises, exerciseMuscles.
   *  Exercises include tombstoned customs (deletedAt set) so history still counts. */
  data: TrainingData;
  settings: {
    weekStartsOn: WeekStartDay;
    /** Already resolved: DEFAULT_TARGETS merged with the user's overrides. */
    targets: Record<MuscleId, VolumeTarget>;
    equipment: Equipment[];
    unit: WeightUnit;
  };
  program: {
    active: Program | null;
    /** Keyed by program id; same shape as the `programBlocks` setting. */
    blocks: Record<string, ProgramBlock>;
  };
  /** Dismissal key → timestamp; same shape as the `deloadDismissals` setting. */
  deloadDismissals: Record<string, number>;
  now: number;
}
```

Rules:

- Queries never call `Date.now()`; time comes from `input.now` or an explicit `refTs` argument.
- `planVsActual` filters `data.exercises` (and their muscle links) to `deletedAt === undefined`
  before calling `planCheck`, matching today's `loadPlanData()` which excludes tombstones.
- The plan-check targets used by `planVsActual` are `settings.targets` (identical to today's
  `loadPlanData().targets`).

### Queries

Each replaces one current `db/` function and returns the same value.

| Query                                                   | Replaces (today)                                      |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `analyzeView(input, refTs): AnalyzeView`                | `analyzeRepo.getAnalyzeView`                          |
| `analysis(input, refTs): AnalysisView`                  | `analysisRepo.getAnalysis`                            |
| `exerciseInsight(input, exerciseId, excludeSessionId?)` | `analysisRepo.getExerciseInsight`                     |
| `alternatives(input, exerciseId)`                       | `analysisRepo.getAlternatives` (uses `input.now`)     |
| `deloadSignal(input)`                                   | `progressRepo.getDeloadSignal`                        |
| `exerciseDeloadHint(input, exerciseId)`                 | `progressRepo.getExerciseDeloadHint`                  |
| `longTrend(input, refTs)`                               | `progressRepo.getLongTrend`                           |
| `e1rmHistory(input, exerciseId)`                        | `progressRepo.getE1rmHistory`                         |
| `planVsActual(input, refTs)`                            | `planVsActualRepo.getPlanVsActual` (uses `input.now`) |

`countFinishedSessions` moves with `analyzeView`. The anonymous return type of today's
`getExerciseInsight` is named `ExerciseInsight = { stats: ExerciseStats; target: ProgressionTarget }`
(`null` when the exercise is unknown). View types `AnalysisView`, `AnalyzeView`,
`LongTrend`, `ExerciseDeloadHint`, `PlanVsActualView` move from `db/` to `analysis/types.ts`;
`db/` hook files re-export them where components import them today.

The recommend engine's `alternatives` function and the new query share a name; the query module
imports the engine function under an alias (e.g. `scoreAlternatives`) and the public index exports
the engine one as `scoreAlternatives` for `programsRepo`.

### `AnalysisClient`

```ts
interface AnalysisClient {
  getAnalyzeView(refTs: number): Promise<AnalyzeView>;
  getAnalysis(refTs: number): Promise<AnalysisView>;
  getExerciseInsight(
    exerciseId: string,
    excludeSessionId?: string,
  ): Promise<ExerciseInsight | null>;
  getAlternatives(exerciseId: string): Promise<AlternativeScore[]>;
  getDeloadSignal(): Promise<DeloadSignal | null>;
  getExerciseDeloadHint(exerciseId: string): Promise<ExerciseDeloadHint | null>;
  getLongTrend(refTs?: number): Promise<LongTrend>;
  getE1rmHistory(exerciseId: string): Promise<E1rmPoint[]>;
  getPlanVsActual(refTs: number): Promise<PlanVsActualView | null>;
}
```

### `LocalAnalysisClient`

- `loadAnalysisInput(now = Date.now())` reads all tables and settings the input needs inside **one**
  Dexie read transaction (today's reads are split across transactions; one is at least as
  consistent).
- Each method: `query(await loadAnalysisInput(), ...args)`.
- `db/localAnalysisClient.ts` exports `analysisClient: AnalysisClient = new LocalAnalysisClient()`.
  Hooks (`useAnalyzeView`, `useAnalysis`, `useExerciseInsight`, `useAlternatives`,
  `useDeloadSignal`, `useExerciseDeloadHint`, `useLongTrend`, `useE1rmHistory`, `usePlanVsActual`)
  call `analysisClient` inside `useLiveQuery`, so live updates keep working. Swapping to a remote
  client later is a one-line change here (live updates would then need their own design).
- Every call now also reads settings and the active program (a few small rows); `loadTrainingData`
  already reads all large tables. `perf.test.ts` and `profilesPerf.test.ts` confirm no regression.
- The emptied functions in `analyzeRepo.ts`, `analysisRepo.ts`, `progressRepo.ts` (except
  `dismissDeload`) and `planVsActualRepo.ts` are deleted; `loadTrainingData` moves into
  `localAnalysisClient.ts`.

### Future backend (not built now)

- Server owns data: server builds `AnalysisInput` from its store and calls the same queries;
  the client gets a `RemoteAnalysisClient` that fetches results.
- Client posts snapshot: `RemoteAnalysisClient` builds the input locally and posts it.

## 3. Errors, testing, migration

**Errors.** Queries are pure and add no failure modes; they return `null` where today's functions
do. `LocalAnalysisClient` lets Dexie errors propagate to `useLiveQuery` as today.

**Testing.**

- Engine tests move with their files unchanged.
- New tests, one file per query module in `analysis/queries/`, use plain `AnalysisInput` objects built
  from `engine/fixtures.ts` (no fake-indexeddb). They cover each query's current behaviour,
  including: tombstone filtering in `planVsActual`, deload dismissal expiry, `excludeSessionId` in
  `exerciseInsight`, block week selection, and the empty-data case.
- A serialization test asserts `structuredClone`/`JSON` round-trip equality of an `AnalysisInput`
  and of every query result for a generated dataset.
- `analyzeRepo.test`, `progressRepo.test`, `planVsActualRepo.test`, `profilesPerf.test` switch to
  `analysisClient` with unchanged assertions.
- The lint rule is checked once by hand with a deliberate bad import.
- Full gate: `npm run lint`, `tsc -b`, Vitest, Playwright e2e (`phase4`, `phase5`, `cardio` cover
  Analyze, progress and plan vs actual), plus a visual check of the Analyze page.

**Migration order** (one commit per step, app green after each):

1. Move row types to `analysis/types.ts`; re-export from `db/types.ts`; fix `config/training.ts`.
2. Move `analyzer/` → `analysis/engine/` and `recommend/` → `analysis/recommend/`; add
   `analysis/index.ts`; rewrite all imports. Pure move.
3. Add `AnalysisInput`, `analysis/targets.ts` (`resolveTargets`), `loadAnalysisInput`.
4. Extract queries one feature at a time (Analyze, insight/alternatives, progress, plan vs actual),
   each with its query tests; `db/` functions temporarily delegate to them.
5. Add `AnalysisClient` + `LocalAnalysisClient`; point hooks and repo tests at it; delete the
   delegating `db/` functions.
6. Add the ESLint boundary rule and a "Portable analysis core" section in `README.md`.

## Out of scope

- Any server, API, network client or sync.
- Program editor queries (`getPlanCheck`, `getProgramAlternatives`); they keep calling engines via
  `@/analysis` and can move behind the client later the same way.
- Turning the module into a workspace package.
- Changes to UI view-model helpers (`analyzeModel.ts`, `muscleSort.ts`).
