# Analysis Module (Portable Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all "training data in → insight out" logic into `src/analysis/` behind a pure, serializable query layer and an `AnalysisClient` interface, with no user-visible change.

**Architecture:** Engines (`analyzer/`, `recommend/`) move into `src/analysis/`. New pure queries take one `AnalysisInput` snapshot and return today's view objects. `db/localAnalysisClient.ts` builds the snapshot from Dexie in one read transaction and calls the queries; hooks call only the client. An ESLint override forbids the portable core from importing persistence or UI.

**Tech Stack:** TypeScript, React 19, Dexie + dexie-react-hooks, Vitest (+ fake-indexeddb), Playwright, ESLint flat config (typescript-eslint).

**Spec:** `docs/superpowers/specs/2026-11-01-analysis-module-design.md`

## Global Constraints

- Branch: `refactor/analysis-module`. One commit per task; every commit passes `npm run typecheck`, `npm run lint`, `npm test`.
- Behaviour is unchanged: existing test assertions are not edited, only their imports and the function they call.
- Portable core = `src/analysis/**`, `src/program/**`, `src/data/**`, `src/config/training.ts`, `src/lib/units.ts`, `src/lib/weight.ts`. It must not import `@/db`, `@/db/*`, `@/components/*`, `@/pages/*`, `react`, `react-dom`, `dexie`, `dexie-react-hooks`.
- Inside `src/analysis/`, files import each other by **relative path**, never via `@/analysis` (avoids index cycles).
- `src/program/**` imports engine code from `@/analysis/engine` (the engine index), **not** `@/analysis` — the top-level index re-exports `queries/planVsActual`, which imports `@/program`, so going through it would create a runtime cycle.
- Queries never call `Date.now()`; time comes from `input.now` or an explicit `refTs`.
- `AnalysisInput` and every query result must survive `JSON.parse(JSON.stringify(x))` unchanged (no `Map`, `Set`, `Date`, `undefined`-only semantics that JSON drops are fine since optional fields stay absent).
- Client methods keep today's optional trailing `now` parameter where the repo function has one (`getAlternatives`, `getDeloadSignal`, `getExerciseDeloadHint`, `getPlanVsActual`) so existing repo tests keep their calls. `now` defaults to `Date.now()` in `LocalAnalysisClient` only.
- Spec refinement (no behaviour change): row types live in `src/analysis/rows.ts` and are re-exported from `src/analysis/types.ts`, so `engine/types.ts` can import them without a type cycle through the view types.

## Review Focus

1. **Tombstoned custom exercises** — a deleted custom exercise with history must still count toward Analyze volume, but must not appear in plan-vs-actual's planned volume. Pinned by Task 7's `excludes tombstoned customs from the plan` test.
2. **A built-in program as the active program** — `getActiveProgram` resolves `builtin-*` ids without a `db.programs` row; `loadAnalysisInput` must still return it. Pinned by Task 3's `loads a built-in active program` test.
3. **Live updates after the hook swap** — editing a set must still re-render Analyze, since reads now happen inside `loadAnalysisInput`. Pinned by Task 8's e2e run (`phase5`, `cardio` edit flows) plus Task 8's `re-runs after a write` test.
4. **Empty database / first launch** — no sessions, no program, no settings rows: every query returns today's empty/`null` shape without throwing. Pinned by Task 8's `every client method works on an empty profile` test.
5. **Cardio-only weeks** — a week with only cardio entries still produces Analyze volume and a summary. Pinned by Task 4's `credits cardio-only weeks` test.

---

## File Structure

```
src/analysis/
  rows.ts                 Session, SessionExercise, SetRow, CardioEntry, CardioIntensity, CARDIO_INTENSITIES
  types.ts                re-exports rows; AnalysisInput, AnalysisSettings, AnalysisView, AnalyzeView,
                          ExerciseInsight, ExerciseDeloadHint, LongTrend, PlanVsActualView
  targets.ts              TargetOverrides type, resolveTargets
  client.ts               AnalysisClient interface
  index.ts                public API (engine + recommend + types + targets + queries + client)
  engine/                 ← src/analyzer/* (index.ts, types.ts, volume.ts, ... + their tests, fixtures.ts)
  recommend/              ← src/recommend/* (+ tests)
  queries/
    testInput.ts          makeInput() helper for query tests
    analyzeView.ts        analysis, analyzeView, countFinishedSessions
    exerciseInsight.ts    exerciseInsight, alternatives
    progress.ts           deloadSignal, exerciseDeloadHint, longTrend, e1rmHistory
    planVsActual.ts       planVsActual
    *.test.ts             one per module, plus serialization.test.ts
src/db/localAnalysisClient.ts   loadTrainingData, loadAnalysisInput, LocalAnalysisClient, analysisClient
src/db/localAnalysisClient.test.ts
```

Deleted by the end: `src/analyzer/`, `src/recommend/`, `src/db/analysisRepo.ts`, `src/db/analyzeRepo.ts`, `src/db/planVsActualRepo.ts`. `src/db/progressRepo.ts` keeps only `dismissDeload`.

---

### Task 1: Row types move into the analysis module

**Files:**

- Create: `src/analysis/rows.ts`
- Modify: `src/db/types.ts` (move `Session`, `SessionExercise`, `SetRow`, `CARDIO_INTENSITIES`, `CardioIntensity`, `CardioEntry` out; re-export them)
- Modify: `src/config/training.ts:7`, `src/program/planVsActual.ts:4`, `src/analyzer/{types,volume,cardio,fixtures,analyzer.test,cardio.test}.ts` — import those types from `@/analysis/rows`

**Interfaces:**

- Produces: `@/analysis/rows` exporting exactly the six names above, unchanged definitions (including doc comments). `@/db/types` still exports them via `export type { ... } from '@/analysis/rows'` and `export { CARDIO_INTENSITIES } from '@/analysis/rows'`.

- [ ] **Step 1: Cut the six definitions from `src/db/types.ts` into `src/analysis/rows.ts`**, add the re-exports to `db/types.ts`, and update the eight importers listed above.
- [ ] **Step 2: Verify no portable-core file imports `@/db`**

Run: `grep -rn "from '@/db" src/analyzer src/recommend src/program src/data src/config/training.ts src/lib/units.ts src/lib/weight.ts`
Expected: no output.

- [ ] **Step 3: Run the gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass, same test count as before the task.

- [ ] **Step 4: Commit** — `refactor(analysis): move training row types into analysis/rows`

---

### Task 2: Move engines into `src/analysis/` (pure move)

**Files:**

- Move: `git mv src/analyzer src/analysis/engine`, `git mv src/recommend src/analysis/recommend`
- Create: `src/analysis/index.ts`
- Modify: every importer of `@/analyzer`, `@/analyzer/*`, `@/recommend` (52 files incl. `src/perf.test.ts`, `src/db/*`, `src/components/**`, `src/pages/*`, `src/program/*`)

**Interfaces:**

- Produces:
  - `@/analysis/engine` — today's `src/analyzer/index.ts`, unchanged exports.
  - `@/analysis/recommend` — today's `src/recommend/index.ts`, unchanged exports.
  - `@/analysis` — `export * from './engine'; export * from './recommend';` (grows in later tasks).
  - Test fixtures at `@/analysis/engine/fixtures`.

- [ ] **Step 1: `git mv` both folders.**
- [ ] **Step 2: Rewrite internal imports** inside `src/analysis/**` to relative paths (e.g. `recommend/deload.ts`: `@/analyzer/exerciseStats` → `../engine/exerciseStats`).
- [ ] **Step 3: Rewrite external imports.**
  - `src/program/**`: `@/analyzer`, `@/analyzer/{types,volume,week,exerciseStats}` → `@/analysis/engine` (or the matching `@/analysis/engine/<file>` for deep imports already used there); `@/analyzer/fixtures` → `@/analysis/engine/fixtures`.
  - Everywhere else: `@/analyzer`, `@/analyzer/cardio`, `@/analyzer/types`, `@/recommend` → `@/analysis`; `@/analyzer/fixtures` → `@/analysis/engine/fixtures`.
- [ ] **Step 4: Verify nothing references the old paths**

Run: `grep -rn "@/analyzer\|@/recommend" src e2e`
Expected: no output.

- [ ] **Step 5: Run the gate** — `npm run typecheck && npm run lint && npm test`; Expected: all pass, same test count.
- [ ] **Step 6: Commit** — `refactor(analysis): move analyzer and recommend engines under src/analysis`

---

### Task 3: `AnalysisInput`, `resolveTargets` and `loadAnalysisInput`

**Files:**

- Create: `src/analysis/types.ts`, `src/analysis/targets.ts`, `src/db/localAnalysisClient.ts`, `src/db/localAnalysisClient.test.ts`
- Modify: `src/db/settingsRepo.ts` (delete `resolveTargets`, import it and `TargetOverrides` from `@/analysis`; keep `TargetOverridesSchema` and re-export `TargetOverrides` type for existing callers), `src/db/analysisRepo.ts` (delete `loadTrainingData`, import it from `./localAnalysisClient`), `src/analysis/index.ts`

**Interfaces:**

- Produces:
  ```ts
  // src/analysis/targets.ts
  export type TargetOverrides = Partial<Record<MuscleId, VolumeTarget>>;
  export function resolveTargets(overrides: TargetOverrides): Record<MuscleId, VolumeTarget>; // { ...DEFAULT_TARGETS, ...overrides }

  // src/analysis/types.ts
  export * from './rows';
  export interface AnalysisSettings {
    weekStartsOn: WeekStartDay;
    targets: Record<MuscleId, VolumeTarget>;
    equipment: Equipment[];
    unit: WeightUnit;
  }
  export interface AnalysisInput {
    data: TrainingData & { exercises: MergedExercise[] };
    settings: AnalysisSettings;
    program: { active: Program | null; blocks: Record<string, ProgramBlock> };
    deloadDismissals: Record<string, number>;
    now: number;
  }

  // src/db/localAnalysisClient.ts
  export async function loadTrainingData(): Promise<AnalysisInput['data']>; // moved verbatim from analysisRepo
  export async function loadAnalysisInput(now?: number): Promise<AnalysisInput>;
  ```
- `TargetOverrides` must stay assignable from `z.infer<typeof TargetOverridesSchema>`; if the inferred type differs, keep the schema in `settingsRepo` and have `targets.ts` declare the structural type above.

- [ ] **Step 1: Write failing tests in `src/db/localAnalysisClient.test.ts`** (fake-indexeddb, `beforeEach(resetDb)`):
  - `loads defaults on an empty profile`: `loadAnalysisInput(NOW)` → `settings.weekStartsOn === 1`, `settings.targets` deep-equals `DEFAULT_TARGETS`, `settings.unit === 'kg'`, `settings.equipment` contains `'bodyweight'`, `program.active === null`, `program.blocks` deep-equals `{}`, `deloadDismissals` deep-equals `{}`, `now === NOW`, `data.sessions` is `[]`, `data.exercises.length` equals seed `exercises.length`.
  - `loads settings, overrides and a built-in active program`: after `setWeekStartsOn(0)`, `setTargetOverrides({ chest: { mev: 1, mavLow: 2, mavHigh: 3, mrv: 4 } })`, `activateProgram('builtin-full-body')`, `startBlock('builtin-full-body', { now: NOW })`, `setDeloadDismissals({ k: 5 })` → `weekStartsOn === 0`, `targets.chest.mrv === 4`, `program.active?.id === 'builtin-full-body'`, `Object.keys(program.blocks)` equals `['builtin-full-body']`, `deloadDismissals` equals `{ k: 5 }`.
  - `keeps tombstoned customs`: create a custom exercise, log one set for it, delete it (soft) → `data.exercises.find(e => e.id === id)?.deletedAt` is a number.
- [ ] **Step 2: Run** `npx vitest run src/db/localAnalysisClient.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `targets.ts`, `types.ts`, and `loadAnalysisInput`. `loadAnalysisInput` runs one `db.transaction('r', [...the eight tables loadTrainingData reads, db.settings, db.programs], ...)` and inside it awaits `loadTrainingData()`, `getWeekStartsOn()`, `getTargetOverrides()` (→ `resolveTargets`), `getEquipment()`, `getUnit()`, `getActiveProgram()`, `getProgramBlocks()`, `getDeloadDismissals()`. `now` defaults to `Date.now()`. Export `types.ts` and `targets.ts` from `src/analysis/index.ts`.
- [ ] **Step 4: Run** the new test file, then the gate. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(analysis): add AnalysisInput and a single-transaction input loader`

---

### Task 4: Analyze page queries

**Files:**

- Create: `src/analysis/queries/testInput.ts`, `src/analysis/queries/analyzeView.ts`, `src/analysis/queries/analyzeView.test.ts`
- Modify: `src/analysis/types.ts` (add `AnalysisView`, `AnalyzeView` — moved from `db/analysisRepo.ts` / `db/analyzeRepo.ts`), `src/db/analysisRepo.ts` (`getAnalysis` delegates), `src/db/analyzeRepo.ts` (`getAnalyzeView` delegates; `countFinishedSessions` removed, re-export from `@/analysis` if anything imports it), `src/analysis/index.ts`

**Interfaces:**

- Consumes: `AnalysisInput` (Task 3); fixtures `makeData`, `makeSession` from `../engine/fixtures`.
- Produces:

  ```ts
  // testInput.ts (test helper, not exported from the index)
  export function makeInput(
    data: TrainingData,
    over?: Partial<Omit<AnalysisInput, 'data' | 'settings'>> & {
      settings?: Partial<AnalysisSettings>;
    },
  ): AnalysisInput;
  // defaults: weekStartsOn 1, targets DEFAULT_TARGETS, equipment [...EQUIPMENT], unit 'kg',
  //           program { active: null, blocks: {} }, deloadDismissals {}, now = 2026-01-07 12:00 local
  // analyzeView.ts
  export function countFinishedSessions(sessions: Session[], win: WeekWindow): number;
  export function analysis(input: AnalysisInput, refTs: number): AnalysisView;
  export function analyzeView(input: AnalysisInput, refTs: number): AnalyzeView;
  ```

  `analyzeView` uses `input.program.active` for the `{ sessionsDone, plannedSessions }` summary argument; otherwise the body is today's `getAnalyzeView` minus the reads.

- [ ] **Step 1: Write failing tests** (`analyzeView.test.ts`), porting `db/analyzeRepo.test.ts` to pure inputs (`NOW = new Date(2026, 0, 7, 12).getTime()`, `bench(n)` as there):
  - `summarises this week against last`: `analyzeView(makeInput(makeData(makeSession('cur', NOW - DAY, [bench(4)]), makeSession('prev', NOW - 7 * DAY, [bench(3)]))), NOW)` → `summary.sessions` undefined, `summary.totalSets === 4`, `summary.previousTotalSets === 3`, `summary.delta === 1`, `empty === false`.
  - `counts sessions against an active program`: same data with `program.active` = a program with 3 days and the `cur` session given `finishedAt` → `summary.sessions` equals `{ done: 1, planned: 3 }`.
  - `empty profile`: `analyzeView(makeInput(makeData()), NOW).empty === true`.
  - `credits cardio-only weeks`: one finished session at `NOW - DAY` with a `sessionExercises` row for `'running'` and one `cardioEntries` row `{ durationSec: 1800, intensity: 'relaxed', completedAt: NOW - DAY }` (no sets) → `result.current.muscles.quads.sets === 3`, `summary.totalSets > 0`.
  - `analysis matches analyzeView`: `analysis(input, NOW)` deep-equals `{ result, suggestions, empty }` of `analyzeView(input, NOW)`.
- [ ] **Step 2: Run** `npx vitest run src/analysis/queries/analyzeView.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the two queries and `makeInput`; make `getAnalysis(refTs)` = `analysis(await loadAnalysisInput(), refTs)` and `getAnalyzeView(refTs)` = `analyzeView(await loadAnalysisInput(), refTs)`.
- [ ] **Step 4: Run** the new tests and `npx vitest run src/db/analyzeRepo.test.ts src/db/profilesPerf.test.ts` (unchanged), then the gate. Expected: PASS.
- [ ] **Step 5: Commit** — `refactor(analysis): extract analyze view queries`

---

### Task 5: Exercise insight and alternatives queries

**Files:**

- Create: `src/analysis/queries/exerciseInsight.ts`, `src/analysis/queries/exerciseInsight.test.ts`
- Modify: `src/analysis/types.ts` (add `ExerciseInsight`), `src/analysis/recommend/index.ts` + `src/analysis/index.ts` (engine `alternatives` exported publicly as `scoreAlternatives`), `src/db/programsRepo.ts` (use `scoreAlternatives`), `src/db/analysisRepo.ts` (delegate)

**Interfaces:**

- Produces:

  ```ts
  export interface ExerciseInsight {
    stats: ExerciseStats;
    target: ProgressionTarget;
  }
  export function exerciseInsight(
    input: AnalysisInput,
    exerciseId: string,
    excludeSessionId?: string,
  ): ExerciseInsight | null;
  export function alternatives(input: AnalysisInput, exerciseId: string): AlternativeScore[]; // week = analyze(data, input.now, {weekStartsOn, trendWeeks: 0}).current
  ```

  `primaryMuscles` moves with `exerciseInsight` (falls back to seed `exerciseMuscles` when `data.exerciseMuscles` is empty, as today).

- [ ] **Step 1: Write failing tests:**
  - `excludes the current session from history`: two bench sessions `s1` (`NOW - 3*DAY`, 60 kg × 8) and `s2` (`NOW`, 70 kg × 8); `exerciseInsight(input, 'barbell-bench-press', 's2')` → `stats.history.map(h => h.sessionId)` equals `['s1']`, `stats.lastSession?.sessionId === 's1'`; without the third argument history has length 2.
  - `null for an unknown exercise`: `exerciseInsight(input, 'nope')` is `null`.
  - `passes the unit to nextTarget`: same data with `settings.unit = 'lb'` → `exerciseInsight(...).target` deep-equals `nextTarget({ exercise, primaryMuscleIds: ['chest'], history, unit: 'lb', exercises: data.exercises })` called directly with the filtered history.
  - `alternatives respects equipment`: `alternatives(makeInput(data, { settings: { equipment: ['bodyweight'] } }), 'barbell-bench-press')` → every result's exercise uses only `bodyweight` equipment (look up via `data.exercises`); with full equipment the list is non-empty.
- [ ] **Step 2: Run** the test file — Expected: FAIL.
- [ ] **Step 3: Implement**; `getExerciseInsight` / `getAlternatives(exerciseId, now = Date.now())` delegate via `loadAnalysisInput(now)`.
- [ ] **Step 4: Run** new tests + gate. Expected: PASS.
- [ ] **Step 5: Commit** — `refactor(analysis): extract exercise insight and alternatives queries`

---

### Task 6: Progress queries

**Files:**

- Create: `src/analysis/queries/progress.ts`, `src/analysis/queries/progress.test.ts`
- Modify: `src/analysis/types.ts` (add `ExerciseDeloadHint`, `LongTrend`, moved from `db/progressRepo.ts`), `src/db/progressRepo.ts` (getters delegate; `dismissDeload` unchanged), `src/db/progressHooks.ts` (type imports from `@/analysis`)

**Interfaces:**

- Produces:

  ```ts
  export function deloadSignal(input: AnalysisInput): DeloadSignal | null; // dismissal window: TRAINING.deload.dismissMs vs input.now
  export function exerciseDeloadHint(
    input: AnalysisInput,
    exerciseId: string,
  ): ExerciseDeloadHint | null; // key `exercise:${exerciseId}`
  export function longTrend(input: AnalysisInput, refTs: number): LongTrend; // targets = input.settings.targets
  export function e1rmHistory(input: AnalysisInput, exerciseId: string): E1rmPoint[];
  ```

- [ ] **Step 1: Write failing tests**, porting `db/progressRepo.test.ts`'s `load()` data builder to return `TrainingData` (same `T0`, weights, reps, RIR, and `only` filter) and using `makeInput(data, { now, deloadDismissals })`:
  - `deload signal honours dismissal and expiry`: `now = T0 + 12*DAY` → `overall === true`; with `deloadDismissals = { [key]: now }` and `now + DAY` → `null`; at `now + TRAINING.deload.dismissMs + 1` → not `null`.
  - `long trend and e1RM history`: `longTrend(input, T0 + 12*DAY).trend.chest` has length `TRAINING.longTrendWeeks + 1`; `e1rmHistory(input, 'barbell-bench-press')` rounded to 2 dp equals `[120, 120, 116.67, 110]`.
  - `per-exercise hint only without an overall signal`: bench-only data → `deloadSignal` is `null`; hint `detail` matches `/e1RM down \d+% over 4 sessions/`; squat hint `null`; with `deloadDismissals = { 'exercise:barbell-bench-press': now }` at `now + DAY` → `null`.
  - `no per-exercise hint during a full deload`: full data → `exerciseDeloadHint(input, 'barbell-bench-press')` is `null`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement**; repo getters become `query(await loadAnalysisInput(now), ...)` keeping their current signatures and defaults.
- [ ] **Step 4: Run** new tests, `npx vitest run src/db/progressRepo.test.ts` (unchanged), then gate. Expected: PASS.
- [ ] **Step 5: Commit** — `refactor(analysis): extract progress and deload queries`

---

### Task 7: Plan-vs-actual query

**Files:**

- Create: `src/analysis/queries/planVsActual.ts`, `src/analysis/queries/planVsActual.test.ts`
- Modify: `src/analysis/types.ts` (add `PlanVsActualView`), `src/db/planVsActualRepo.ts` (delegate), `src/db/planVsActualHooks.ts` (type import)

**Interfaces:**

- Produces: `export function planVsActual(input: AnalysisInput, refTs: number): PlanVsActualView | null;` — `null` when `input.program.active` is `null`; plan exercises = `data.exercises.filter(e => e.deletedAt === undefined)` and `data.exerciseMuscles` restricted to those ids; plan targets = `input.settings.targets`; `inProgress = win.end > input.now`.

- [ ] **Step 1: Write failing tests** (`wed = new Date(2026, 2, 4, 18).getTime()`; active program = `getBuiltInProgram('builtin-full-body')`; block = `newBlock(wed, 1, defaultRampExerciseIds(program))`, placed in `program.blocks['builtin-full-body']`):
  - `null without an active program`.
  - `uses the block week and lists days not done`: data with one finished session tagged `programId: 'builtin-full-body', programDayId: 'fb-a'` at `wed` → `blockWeek === 1`, `result.daysDone === 1`, undone day ids equal `['fb-b', 'fb-c']`, `inProgress === true`; quads planned equals the no-block result's quads planned; at `refTs = wed + 7*DAY, now = wed + 14*DAY` → `blockWeek === 2`, quads planned greater than week 1, `inProgress === false`, `result.daysSkipped === 3`.
  - `excludes tombstoned customs from the plan`: a user program whose only exercise is a custom id; with that custom in `data.exercises` and `deletedAt: 1` → every `result.muscles[*].planned === 0`; without `deletedAt` → its primary muscle's `planned > 0`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement**; `getPlanVsActual(refTs, now = Date.now())` delegates via `loadAnalysisInput(now)`.
- [ ] **Step 4: Run** new tests, `npx vitest run src/db/planVsActualRepo.test.ts` (unchanged), gate. Expected: PASS.
- [ ] **Step 5: Commit** — `refactor(analysis): extract plan vs actual query`

---

### Task 8: `AnalysisClient`, `LocalAnalysisClient`, hook swap, serialization

**Files:**

- Create: `src/analysis/client.ts`, `src/analysis/queries/serialization.test.ts`
- Modify: `src/db/localAnalysisClient.ts`, `src/db/localAnalysisClient.test.ts`, `src/db/hooks.ts`, `src/db/analyzeHooks.ts`, `src/db/progressHooks.ts`, `src/db/planVsActualHooks.ts`, `src/db/analyzeRepo.test.ts`, `src/db/progressRepo.test.ts`, `src/db/planVsActualRepo.test.ts`, `src/db/profilesPerf.test.ts`, `src/db/progressRepo.ts` (keep only `dismissDeload`), `src/analysis/index.ts`
- Delete: `src/db/analysisRepo.ts`, `src/db/analyzeRepo.ts`, `src/db/planVsActualRepo.ts`

**Interfaces:**

- Produces:

  ```ts
  export interface AnalysisClient {
    getAnalyzeView(refTs: number): Promise<AnalyzeView>;
    getAnalysis(refTs: number): Promise<AnalysisView>;
    getExerciseInsight(
      exerciseId: string,
      excludeSessionId?: string,
    ): Promise<ExerciseInsight | null>;
    getAlternatives(exerciseId: string, now?: number): Promise<AlternativeScore[]>;
    getDeloadSignal(now?: number): Promise<DeloadSignal | null>;
    getExerciseDeloadHint(exerciseId: string, now?: number): Promise<ExerciseDeloadHint | null>;
    getLongTrend(refTs?: number): Promise<LongTrend>;
    getE1rmHistory(exerciseId: string): Promise<E1rmPoint[]>;
    getPlanVsActual(refTs: number, now?: number): Promise<PlanVsActualView | null>;
  }
  // src/db/localAnalysisClient.ts
  export class LocalAnalysisClient implements AnalysisClient {
    /* each: query(await loadAnalysisInput(now), ...) */
  }
  export const analysisClient: AnalysisClient = new LocalAnalysisClient();
  ```

  `countFinishedSessions` (if imported anywhere outside tests) now comes from `@/analysis`. Hook files re-export the view types components already import from them.

- [ ] **Step 1: Write failing tests.**
  - `serialization.test.ts`: `input = makeInput(generateTrainingData({ weeks: 12, sessionsPerWeek: 4, startTs: NOW - 12 * 7 * DAY, seed: 7 }), { program: { active: getBuiltInProgram('builtin-full-body')!, blocks: {} } })`; assert `JSON.parse(JSON.stringify(x))` deep-equals `x` for `input` and for the result of every query (`analyzeView`, `analysis`, `exerciseInsight` and `alternatives` for `'barbell-bench-press'`, `deloadSignal`, `exerciseDeloadHint`, `longTrend`, `e1rmHistory`, `planVsActual`).
  - `localAnalysisClient.test.ts` additions:
    - `every client method works on an empty profile`: each of the nine methods resolves without throwing; `getAnalyzeView(NOW).empty === true`, `getPlanVsActual(NOW)` is `null`, `getDeloadSignal()` is `null`, `getE1rmHistory('barbell-bench-press')` equals `[]`, `getExerciseInsight('nope')` is `null`.
    - `re-runs after a write`: `liveQuery(() => analysisClient.getAnalyzeView(NOW))` subscribed; after `db.sets.bulkAdd` of a bench session in the current week, the next emitted value has `summary.totalSets` greater than the first.
- [ ] **Step 2: Run** both files — Expected: FAIL (client not defined).
- [ ] **Step 3: Implement** `client.ts` and `LocalAnalysisClient`; point every hook listed above at `analysisClient`; switch the four repo/perf test files to `analysisClient.<method>` (same arguments, same assertions; `dismissDeload` still from `./progressRepo`); delete the three emptied repo files and the getters in `progressRepo.ts`.
- [ ] **Step 4: Verify no stale callers**

Run: `grep -rn "analysisRepo\|analyzeRepo\|planVsActualRepo\|getDeloadSignal\|getLongTrend" src | grep -v "analysisClient\|localAnalysisClient"`
Expected: only `.test.ts` describe-block names, no imports.

- [ ] **Step 5: Run the gate and e2e**

Run: `npm run typecheck && npm run lint && npm test && npm run e2e`
Expected: all pass; `profilesPerf.test` and `perf.test` within their existing budgets.

- [ ] **Step 6: Visual check** — start the `lift-log` dev server via `preview_start`, open `/analyze` with the test account data, confirm summary card, muscle list, plan-vs-actual card and volume trend render; screenshot.
- [ ] **Step 7: Commit** — `refactor(analysis): route analysis through AnalysisClient`

---

### Task 9: Boundary lint rule and README

**Files:**

- Modify: `eslint.config.js`, `README.md`

**Interfaces:**

- Produces: a flat-config block after the TS block:

  ```js
  {
    files: ['src/analysis/**/*.ts', 'src/program/**/*.ts', 'src/data/**/*.ts',
            'src/config/training.ts', 'src/lib/units.ts', 'src/lib/weight.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { group: ['@/db', '@/db/*', '@/components/*', '@/pages/*'], message: 'Portable analysis core must not depend on persistence or UI.' },
      { group: ['react', 'react-dom', 'react/*', 'dexie', 'dexie-react-hooks'], message: 'Portable analysis core must stay framework-free.' },
    ] }] },
  }
  ```

- [ ] **Step 1: Prove the rule bites** — temporarily add `import { db } from '@/db/db';` to `src/analysis/targets.ts`; run `npx eslint src/analysis/targets.ts`; Expected: `no-restricted-imports` error with the message above. Remove the line.
- [ ] **Step 2: Add the rule** and run `npm run lint` — Expected: clean.
- [ ] **Step 3: Add a "Portable analysis core" section to `README.md`** (≤ 15 lines): what the portable core is, the lint rule, `AnalysisInput` as the contract, `analysisClient` in `src/db/localAnalysisClient.ts` as the swap point, and the two future backend shapes (server builds the input / client posts it).
- [ ] **Step 4: Final gate** — `npm run typecheck && npm run lint && npm test && npm run e2e && npm run build`; Expected: all pass.
- [ ] **Step 5: Commit** — `chore(analysis): enforce portable-core import boundary and document it`
