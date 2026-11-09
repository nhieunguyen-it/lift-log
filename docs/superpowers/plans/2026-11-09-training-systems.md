# Training Systems Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-exercise training systems (Progression / Pyramid ▲ / Pyramid ▼ / PITT-Force + main focus) in programs, system-aware pre-filled set rows, and a two-tone PITT-Force pacing timer.

**Architecture:** A pure `planSets` planner in `src/analysis/recommend/systems.ts` turns (system, rep range, set count, last session) into per-set weight/reps. `startProgramDay` snapshots `system`/`mainFocus`/`repRange` onto each `SessionExercise` and pre-fills rows from the planner; `TargetChip`, the card badge and `PittTimer` read the snapshot. Timer phases come from a pure time-based function; sound is generated Web Audio.

**Tech Stack:** React 19, TypeScript, Dexie 4 + dexie-react-hooks, zod 4, Tailwind 4 + Radix, Vitest + fake-indexeddb, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-training-systems-design.md`

## Global Constraints

- System ids: `'progression' | 'pyramid_up' | 'pyramid_down' | 'pitt_force'`; stored form never contains `'progression'` (absent key = progression).
- `mainFocus` stored only as `true`; only valid when the system is progression.
- No Dexie schema version bump. Program file stays `version: 1`. Backup becomes `BACKUP_VERSION = 8`; v1–v7 must still import.
- PITT settings: `pittRepSec` int 1–10 default 2; `pittPauseSec` int 1–10 default 4; `pittSound` boolean default true; countdown 3 s.
- Tones: tick 660 Hz 60 ms; GO 880 Hz 150 ms; HOLD 440 Hz 150 ms; done 880 Hz then 1320 Hz, 120 ms each. No audio files.
- PITT-Force with no rep range uses `{ min: 20, max: 20 }`.
- RIR is never pre-filled. Typed values are never overwritten by the chip.
- Ad-hoc (non-program) exercises behave exactly as today.
- Each task ends with `npm run typecheck && npm run lint` clean plus its own tests passing; final task runs `npm run check && npm run e2e`.

## Review Focus

1. **Program edited or deleted mid-workout** → the running session keeps behaving per its snapshot (badge, chip, timer unchanged). Test in Task 5.
2. **A history set logged without a weight** (weight field left blank) in a pyramid slot → treated as a missing slot, not as 0 kg. Test in Task 4.
3. **Pounds users** → planned weights land on the same loadable values the existing engine produces (no 102.06 kg oddities). Test in Task 4.
4. **PITT timer with no open set** (all sets ticked done) → Start is disabled; nothing is written. Test in Task 10.
5. **Leaving the workout / unmounting while the timer runs** → all scheduled tones are cancelled and the wake lock released; no stray dings. Test in Task 10.

---

### Task 1: Types, system metadata and program edit helpers

**Files:**

- Modify: `src/program/types.ts` (add types, extend `ProgramExercise`)
- Modify: `src/analysis/rows.ts` (extend `SessionExercise`)
- Create: `src/program/systems.ts`
- Modify: `src/program/edit.ts` (add `setSystem`, `setMainFocus`)
- Modify: `src/config/training.ts` (add `pitt` block to `TrainingConfig` and `TRAINING`)
- Test: `src/program/edit.test.ts`, `src/program/systems.test.ts`

**Interfaces:**

- Produces:
  - `TRAINING_SYSTEMS` (readonly tuple), `type TrainingSystem`, `type StoredSystem = Exclude<TrainingSystem, 'progression'>` in `src/program/types.ts`.
  - `ProgramExercise.system?: StoredSystem`, `ProgramExercise.mainFocus?: true`.
  - `SessionExercise.system?: StoredSystem`, `.mainFocus?: true`, `.repRange?: RepRange` (rows.ts imports `RepRange` from `@/config/training` and `StoredSystem` from `@/program/types` with `import type`).
  - `systemOf(x: { system?: StoredSystem }): TrainingSystem` and `SYSTEM_INFO: Record<TrainingSystem, { label: string; short: string; hint: string }>` in `src/program/systems.ts`.
  - `PITT_DEFAULT_RANGE: RepRange = { min: 20, max: 20 }` in `src/program/systems.ts`.
  - `edit.setSystem(p: Program, dayId: string, index: number, system: TrainingSystem): Program`
  - `edit.setMainFocus(p: Program, dayId: string, index: number, on: boolean): Program`
  - `TRAINING.pitt = { countdownSec: 3, repSec: 2, pauseSec: 4, minSec: 1, maxSec: 10 }`.

`SYSTEM_INFO` values (exact copy):

| id           | label                     | short       | hint                                                                |
| ------------ | ------------------------- | ----------- | ------------------------------------------------------------------- |
| progression  | Progression               | Progression | Same weight every set. Add weight once every set hits the top reps. |
| pyramid_up   | Pyramid ▲ (light → heavy) | Pyramid ▲   | Start lighter, add weight each set; reps drop.                      |
| pyramid_down | Pyramid ▼ (heavy → light) | Pyramid ▼   | Start heavy, drop weight each set; reps rise.                       |
| pitt_force   | PITT-Force                | PITT-Force  | Single paused reps with 3–4 s rest; the timer paces you.            |

- [ ] **Step 1: Write failing tests** in `src/program/edit.test.ts` (reuse the file's existing program fixture) and `src/program/systems.test.ts`:

```ts
it('setSystem stores non-progression systems and clears main focus', () => {
  let p = edit.setMainFocus(prog, dayId, 0, true);
  expect(p.days[0].exercises[0].mainFocus).toBe(true);
  p = edit.setSystem(p, dayId, 0, 'pyramid_up');
  expect(p.days[0].exercises[0]).toMatchObject({ system: 'pyramid_up' });
  expect('mainFocus' in p.days[0].exercises[0]).toBe(false);
});
it('setSystem progression deletes the key', () => {
  const p = edit.setSystem(edit.setSystem(prog, dayId, 0, 'pitt_force'), dayId, 0, 'progression');
  expect('system' in p.days[0].exercises[0]).toBe(false);
});
it('setSystem pitt_force fills an empty rep range with 20-20 and keeps an existing one', () => {
  expect(edit.setSystem(progNoRange, dayId, 0, 'pitt_force').days[0].exercises[0].repRange).toEqual(
    { min: 20, max: 20 },
  );
  expect(
    edit.setSystem(progWithRange8to12, dayId, 0, 'pitt_force').days[0].exercises[0].repRange,
  ).toEqual({ min: 8, max: 12 });
});
it('setMainFocus is a no-op off progression and false deletes the key', () => {
  const pyr = edit.setSystem(prog, dayId, 0, 'pyramid_down');
  expect(edit.setMainFocus(pyr, dayId, 0, true)).toBe(pyr);
  const on = edit.setMainFocus(prog, dayId, 0, true);
  expect('mainFocus' in edit.setMainFocus(on, dayId, 0, false).days[0].exercises[0]).toBe(false);
});
// systems.test.ts
it('systemOf defaults to progression', () => {
  expect(systemOf({})).toBe('progression');
  expect(systemOf({ system: 'pitt_force' })).toBe('pitt_force');
});
```

- [ ] **Step 2:** Run `npx vitest run src/program/edit.test.ts src/program/systems.test.ts` — expect FAIL (missing exports).
- [ ] **Step 3:** Implement the types, `systems.ts`, edit helpers (immutable, same style as `setNote`; return the same object for no-ops) and `TRAINING.pitt`.
- [ ] **Step 4:** Run the same command — PASS. Run `npm run typecheck`.
- [ ] **Step 5:** Commit `feat(program): training system types and edit helpers`.

---

### Task 2: Program file fields and the PPL example

**Files:**

- Modify: `src/program/programFile.ts` (`ExerciseSchema`, `toProgram`)
- Modify: `examples/programs/ppl-alternating.json`
- Test: `src/program/programFile.test.ts`, `src/program/examplePrograms.test.ts`

**Interfaces:**

- Consumes: `TRAINING_SYSTEMS` (Task 1).
- Produces: `ProgramFile` exercises with optional `system?: TrainingSystem`, `mainFocus?: boolean`; `toProgram` emits stored form (no `'progression'`, `mainFocus` only when `true`).

- [ ] **Step 1: Write failing tests:**

```ts
it('accepts system and mainFocus and normalises to stored form', () => {
  const res = parseProgramFile(fileWith({ system: 'progression', mainFocus: true }));
  expect(res.ok).toBe(true);
  const p = toProgram(res.file, ids, 'X', 0);
  expect(p.days[0].exercises[0]).toEqual(expect.objectContaining({ mainFocus: true }));
  expect('system' in p.days[0].exercises[0]).toBe(false);
});
it('maps mainFocus false to absent', () => { /* system 'pyramid_up', mainFocus false → { system: 'pyramid_up' }, no mainFocus key */ });
it('rejects an unknown system', () => {
  expect(parseProgramFile(fileWith({ system: 'drop_set' }))).toEqual({
    ok: false,
    errors: ['Day 1 "Legs", exercise 1: system must be one of progression, pyramid_up, pyramid_down, pitt_force'],
  });
});
it('rejects mainFocus with a non-progression system', () => {
  expect(parseProgramFile(fileWith({ system: 'pitt_force', mainFocus: true })).errors).toEqual([
    'Day 1 "Legs", exercise 1: mainFocus is only allowed with the progression system',
  ]);
});
// examplePrograms.test.ts
it('PPL example carries the coach systems', () => {
  const ex = (day: string, id: string) => /* find exercise in parsed example */;
  expect(ex('Legs #1', 'barbell-back-squat')).toMatchObject({ system: 'progression', mainFocus: true });
  expect(ex('Legs #1', 'leg-press')).toMatchObject({ system: 'pyramid_up' });
  expect(ex('Legs #1', 'lying-leg-curl')).toMatchObject({ system: 'pitt_force' });
  expect(ex('Push #1', 'dumbbell-fly')).toMatchObject({ system: 'pyramid_down' });
});
```

(`fileWith` = a local helper building a one-day "Legs" file whose first exercise is spread with the given fields; add it if the test file lacks one.)

- [ ] **Step 2:** Run `npx vitest run src/program` — FAIL.
- [ ] **Step 3:** Extend `ExerciseSchema` with `system: z.enum(TRAINING_SYSTEMS, { error: '<msg above>' }).optional()` and `mainFocus: z.boolean(...).optional()`, plus a `.refine` (path `['mainFocus']`) for the main-focus rule; normalise in `toProgram`. Update the example JSON: set `system` on every exercise from the sheet's column D (“Progression with main Focus” → `"system": "progression", "mainFocus": true`; blank → omit), and rewrite notes to keep only real cues: Lying Leg Curl `"pause 3–4 s each"`, Lunges `"each leg 10 reps"`; delete notes that only named the system.
- [ ] **Step 4:** Run `npx vitest run src/program` — PASS.
- [ ] **Step 5:** Commit `feat(program-file): system and mainFocus fields; PPL example uses them`.

---

### Task 3: Backup v8 and PITT settings

**Files:**

- Modify: `src/db/backup.ts` (`BACKUP_VERSION`, `ProgramSchema`, `SessionExerciseSchema`, settings schema, export/import of PITT keys)
- Modify: `src/db/settingsRepo.ts` (PITT get/set)
- Modify: `src/db/hooks.ts` (hook)
- Create: `src/db/backupV8.test.ts`

**Interfaces:**

- Consumes: `TRAINING_SYSTEMS`, `TRAINING.pitt` (Task 1).
- Produces:
  - `interface PittSettings { repSec: number; pauseSec: number; sound: boolean }`
  - `getPittSettings(): Promise<PittSettings>` (invalid/missing → defaults; out-of-range ints → defaults)
  - `setPittSettings(patch: Partial<PittSettings>): Promise<void>` (writes keys `pittRepSec`, `pittPauseSec`, `pittSound`; rejects out-of-range via zod)
  - `usePittSettings(): PittSettings | undefined` in `src/db/hooks.ts`, re-exported from `@/db` like the others.

- [ ] **Step 1: Write failing tests** in `src/db/backupV8.test.ts` (follow `backupV7.test.ts` setup with `resetDb`):

```ts
it('round-trips program systems, session snapshots and PITT settings', async () => {
  // seed: a user program with exercises [{system:'pyramid_up'}, {mainFocus:true}],
  // a session exercise {system:'pitt_force', repRange:{min:20,max:20}}, setPittSettings({repSec:3,pauseSec:5,sound:false})
  const backup = await exportData();
  expect(backup.version).toBe(8);
  await resetDb();
  await importData(backup);
  // assert program exercises, session exercise fields and getPittSettings() equal the seeded values
});
it('a v7 backup imports with no systems and default PITT settings', async () => {
  // build a v7 object (copy shape from backupV7.test.ts), import, expect no `system` keys,
  // getPittSettings() → { repSec: 2, pauseSec: 4, sound: true }
});
it('rejects a stored "progression" system in a backup', async () => {
  // program exercise { system: 'progression' } → import throws / returns validation error like other schema failures
});
```

- [ ] **Step 2:** Run `npx vitest run src/db/backupV8.test.ts` — FAIL.
- [ ] **Step 3:** Implement. Stored-system enum = `TRAINING_SYSTEMS` without `'progression'`; `mainFocus: z.literal(true).optional()`; session `repRange: RepRangeSchema.optional()`; settings `pittRepSec`/`pittPauseSec` `z.number().int().min(1).max(10).optional()`, `pittSound: z.boolean().optional()`; add the PITT keys to the export transaction and restore them on import only when present.
- [ ] **Step 4:** Run `npx vitest run src/db` — PASS (older backup tests still green).
- [ ] **Step 5:** Commit `feat(backup): v8 with training systems and PITT settings`.

---

### Task 4: Set planner

**Files:**

- Modify: `src/analysis/recommend/progression.ts` (export `loadable`, `stepped`)
- Create: `src/analysis/recommend/systems.ts`
- Modify: `src/analysis/recommend/index.ts` (re-export)
- Test: `src/analysis/recommend/systems.test.ts`

**Interfaces:**

- Consumes: `TrainingSystem`, `PITT_DEFAULT_RANGE` (Task 1); `repRangeFor`, `loadStepCategory`, `loadable`, `stepped`.
- Produces:

```ts
export interface PlannedSet {
  weightKg?: number;
  reps: number;
}
export interface HistorySet {
  weightKg?: number;
  reps: number;
}
export function resolveRepRange(
  system: TrainingSystem,
  programRange: RepRange | undefined,
  exercise: Exercise,
  config?: TrainingConfig,
): RepRange;
export function planReps(
  system: TrainingSystem,
  range: RepRange,
  sets: number,
  history: HistorySet[],
): number[];
export function planSets(args: {
  system: TrainingSystem;
  repRange: RepRange;
  sets: number;
  history: HistorySet[];
  exercise: Exercise;
  primaryMuscleIds: MuscleId[];
  unit: WeightUnit;
  deloadWeek?: boolean;
  config?: TrainingConfig;
}): PlannedSet[];
```

`history` = working sets of the most recent earlier session, ordered. Rules are the spec's §2 table; additionally a history slot whose `weightKg` is undefined counts as a missing slot (Review Focus 2). `stepDown` floors at 0 and goes through `loadable`.

- [ ] **Step 1: Write failing tests** (fixtures `ex`/`primary` as in `recommend.test.ts`; `plan = (id, system, range, sets, history, opts?) => planSets({...})`; `h = (pairs) => pairs.map(([weightKg, reps]) => ({ weightKg, reps }))`):

```ts
describe('planReps shapes', () => {
  it('descending / ascending', () => {
    expect(planReps('pyramid_up', { min: 6, max: 15 }, 5, [])).toEqual([15, 13, 11, 8, 6]);
    expect(planReps('pyramid_down', { min: 8, max: 12 }, 4, [])).toEqual([8, 9, 11, 12]);
    expect(planReps('pyramid_up', { min: 12, max: 15 }, 3, [])).toEqual([15, 14, 12]);
    expect(planReps('pyramid_up', { min: 8, max: 12 }, 2, [])).toEqual([12, 8]);
    expect(planReps('pyramid_up', { min: 8, max: 12 }, 1, [])).toEqual([12]);
    expect(planReps('pyramid_down', { min: 8, max: 12 }, 1, [])).toEqual([8]);
  });
});
describe('progression', () => {
  const five = (w: number, r: number) => h(Array(5).fill([w, r]));
  it('steps up when every planned set hit the top', () =>
    expect(plan('barbell-back-squat', 'progression', { min: 5, max: 5 }, 5, five(100, 5))).toEqual(
      Array(5).fill({ weightKg: 105, reps: 5 }),
    ));
  it('holds after a miss', () =>
    expect(
      plan(
        'barbell-back-squat',
        'progression',
        { min: 5, max: 5 },
        5,
        h([
          [100, 5],
          [100, 5],
          [100, 5],
          [100, 3],
          [100, 5],
        ]),
      ),
    ).toEqual(Array(5).fill({ weightKg: 100, reps: 5 })));
  it('holds when fewer sets than planned were done', () =>
    expect(
      plan(
        'barbell-back-squat',
        'progression',
        { min: 5, max: 5 },
        5,
        h(Array(3).fill([100, 5])),
      )[0],
    ).toEqual({ weightKg: 100, reps: 5 }));
  it('range: lowest reps + 1, then reset to min after a step', () => {
    expect(
      plan(
        'barbell-bench-press',
        'progression',
        { min: 8, max: 12 },
        3,
        h([
          [60, 10],
          [60, 9],
          [60, 9],
        ]),
      ),
    ).toEqual(Array(3).fill({ weightKg: 60, reps: 10 }));
    expect(
      plan(
        'barbell-bench-press',
        'progression',
        { min: 8, max: 12 },
        3,
        h(Array(3).fill([60, 12])),
      ),
    ).toEqual(Array(3).fill({ weightKg: 62.5, reps: 8 }));
  });
  it('pure bodyweight leaves weight blank', () =>
    expect(
      plan(
        'push-up',
        'progression',
        { min: 8, max: 20 },
        2,
        h([
          [undefined, 12],
          [undefined, 10],
        ]),
      ),
    ).toEqual(Array(2).fill({ reps: 11 })));
  it('no history: reps only', () =>
    expect(plan('barbell-back-squat', 'progression', { min: 5, max: 5 }, 2, [])).toEqual(
      Array(2).fill({ reps: 5 }),
    ));
  it('lbs lands on the same loadable value as nextTarget', () => {
    const hist = five(102.058, 5);
    const t = nextTarget({
      exercise: ex('barbell-back-squat'),
      primaryMuscleIds: primary('barbell-back-squat'),
      history: [{ sessionId: 's', startedAt: 1, sets: hist }],
      unit: 'lbs',
      config: { ...TRAINING, repRangeOverrides: { 'barbell-back-squat': { min: 5, max: 5 } } },
    });
    expect(
      plan('barbell-back-squat', 'progression', { min: 5, max: 5 }, 5, hist, { unit: 'lbs' })[0]
        .weightKg,
    ).toBe(t.weightKg);
  });
  it('deload week never steps', () =>
    expect(
      plan('barbell-back-squat', 'progression', { min: 5, max: 5 }, 5, five(100, 5), {
        deloadWeek: true,
      })[0].weightKg,
    ).toBe(100));
});
describe('pyramids', () => {
  it('▲ steps only the slots that hit their target', () =>
    expect(
      plan(
        'leg-press',
        'pyramid_up',
        { min: 12, max: 15 },
        3,
        h([
          [100, 15],
          [100, 13],
          [100, 12],
        ]),
      ),
    ).toEqual([
      { weightKg: 102.5, reps: 15 },
      { weightKg: 100, reps: 14 },
      { weightKg: 102.5, reps: 12 },
    ]));
  it('▼ missing slots step down from the previous planned slot', () =>
    expect(
      plan(
        'dumbbell-fly',
        'pyramid_down',
        { min: 8, max: 12 },
        4,
        h([
          [20, 8],
          [18, 9],
        ]),
      ),
    ).toEqual([
      { weightKg: 21, reps: 8 },
      { weightKg: 19, reps: 9 },
      { weightKg: 18, reps: 11 },
      { weightKg: 17, reps: 12 },
    ]));
  it('▲ missing first slot with no weight → blank, later missing slots stay blank', () =>
    expect(plan('leg-press', 'pyramid_up', { min: 12, max: 15 }, 2, h([[undefined, 15]]))).toEqual([
      { reps: 15 },
      { reps: 12 },
    ]));
  it('deload week holds each slot', () =>
    expect(
      plan(
        'leg-press',
        'pyramid_up',
        { min: 12, max: 15 },
        3,
        h([
          [100, 15],
          [100, 14],
          [100, 12],
        ]),
        { deloadWeek: true },
      ).map((s) => s.weightKg),
    ).toEqual([100, 100, 100]));
});
describe('pitt_force and range resolution', () => {
  it('defaults to 20-20 and progression-style stepping', () => {
    expect(resolveRepRange('pitt_force', undefined, ex('lying-leg-curl'))).toEqual({
      min: 20,
      max: 20,
    });
    expect(resolveRepRange('progression', undefined, ex('barbell-bench-press'))).toEqual(
      repRangeFor(ex('barbell-bench-press')),
    );
    expect(resolveRepRange('pyramid_up', { min: 8, max: 12 }, ex('leg-press'))).toEqual({
      min: 8,
      max: 12,
    });
    expect(plan('lying-leg-curl', 'pitt_force', { min: 20, max: 20 }, 1, h([[40, 20]]))).toEqual([
      { weightKg: 42.5, reps: 20 },
    ]);
    expect(plan('lying-leg-curl', 'pitt_force', { min: 20, max: 20 }, 1, h([[40, 17]]))).toEqual([
      { weightKg: 40, reps: 20 },
    ]);
  });
});
```

Before relying on the 2.5 kg / 1 kg steps, confirm `loadStepCategory` gives `other` for `leg-press` and `lying-leg-curl` and `dumbbell` for `dumbbell-fly`; if a catalog entry differs, adjust the expected weights to that category's step, not the rule.

- [ ] **Step 2:** Run `npx vitest run src/analysis/recommend/systems.test.ts` — FAIL.
- [ ] **Step 3:** Implement `systems.ts`; export `loadable`/`stepped` from `progression.ts` (no behaviour change).
- [ ] **Step 4:** Run `npx vitest run src/analysis` — PASS.
- [ ] **Step 5:** Commit `feat(recommend): system-aware set planner`.

---

### Task 5: Snapshot and pre-fill in `startProgramDay`

**Files:**

- Modify: `src/db/programsRepo.ts` (`startProgramDay`)
- Modify: `src/db/sessionsRepo.ts` (`addExercise` accepts snapshot fields)
- Create: `src/db/plannedSets.ts` (history + exercise lookup shared with Task 6)
- Test: `src/db/trainingSystems.test.ts`

**Interfaces:**

- Consumes: `planSets`, `resolveRepRange` (Task 4); `systemOf` (Task 1); `earlierSessionExerciseIds`; `getExerciseWithMuscles`; `getUnit`; `isDeloadWeek` from `@/program/block`.
- Produces:
  - `addExercise(sessionId: string, exerciseId: string, snapshot?: { note?: string; system?: StoredSystem; mainFocus?: true; repRange?: RepRange }): Promise<SessionExercise>` — the third parameter changes from `note?: string` to this object; update every caller (grep `addExercise(`).
  - `planForSessionExercise(se: SessionExercise, opts?: { sets?: number; deloadWeek?: boolean }): Promise<PlannedSet[]>` in `src/db/plannedSets.ts` — loads the most recent earlier session's working sets (`!isWarmup`) for `se`, the exercise + primary muscles (`weight === 1`) and the unit, then calls `planSets` with `resolveRepRange(systemOf(se), se.repRange, exercise)`; `sets` defaults to the current number of set rows.

`startProgramDay` passes `{ note, system, mainFocus, repRange: resolveRepRange(...) }` for every program exercise, then builds rows from `planForSessionExercise(se, { sets: pe.targetSets, deloadWeek })` (omit `weightKg` key when undefined). Note: the transaction table list must include whatever `planForSessionExercise` reads (`db.sets`, `db.sessionExercises`, `db.sessions`, `db.settings`, exercise tables — already present).

- [ ] **Step 1: Write failing tests** (`resetDb` before each; create a user program via `programsRepo` with Legs day: squat progression mainFocus 5×5-5, leg-press pyramid_up 3×12-15, lying-leg-curl pitt_force 1× no range):

```ts
it('snapshots system, mainFocus and resolved repRange', async () => {
  const s = await startProgramDay(pid, dayId);
  const ses = await sessionExercisesOf(s.id);
  expect(ses[0]).toMatchObject({ mainFocus: true, repRange: { min: 5, max: 5 } });
  expect('system' in ses[0]).toBe(false);
  expect(ses[1]).toMatchObject({ system: 'pyramid_up', repRange: { min: 12, max: 15 } });
  expect(ses[2]).toMatchObject({ system: 'pitt_force', repRange: { min: 20, max: 20 } });
});
it('first time: reps pre-filled, weight blank', async () => {
  // leg-press rows → reps [15,14,12], no weightKg key
});
it('second time: rows pre-filled from the previous session', async () => {
  // finish a session with leg-press sets 100×15, 100×13, 100×12 (and squat 5×100×5),
  // start the day again → leg-press [{102.5,15},{100,14},{102.5,12}], squat 5×{105,5}
});
it('warm-up sets in history are ignored', async () => {
  /* a 40×10 warm-up first does not shift slots */
});
it('editing the program after start does not change the running snapshot', async () => {
  // start, then programsRepo save with leg-press system removed → session exercise still pyramid_up
});
it('ad-hoc addExercise has no snapshot fields', async () => {
  /* sessionsRepo.addExercise(sid, 'barbell-back-squat') */
});
it('duplicating a program keeps system and mainFocus', async () => {
  // programsRepo duplicate of the Legs program → copy's exercises carry the same system / mainFocus
});
```

- [ ] **Step 2:** Run `npx vitest run src/db/trainingSystems.test.ts` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run src/db` — PASS (existing `programsRepo`/`phase3` tests adjusted only if they asserted `reps: 0` blank rows for exercises that now have history; update those expectations to the planner output and note it in the commit).
- [ ] **Step 5:** Commit `feat(workout): pre-fill program day sets from the training system`.

---

### Task 6: System-aware Target chip

**Files:**

- Create: `src/analysis/recommend/planLabel.ts` (pure label)
- Modify: `src/db/hooks.ts` (`useSetPlan`)
- Modify: `src/components/recommend/TargetChip.tsx`
- Modify: `src/components/SessionEditor.tsx` (pass the session exercise)
- Test: `src/analysis/recommend/planLabel.test.ts`, `src/db/trainingSystems.test.ts` (fill helper)

**Interfaces:**

- Consumes: `planForSessionExercise` (Task 5), `SYSTEM_INFO`, `systemOf` (Task 1), `kgToDisplay` from `@/lib/units`.
- Produces:
  - `planLabel(system: TrainingSystem, plan: PlannedSet[], unit: WeightUnit): string`
  - `useSetPlan(se: SessionExercise | undefined): PlannedSet[] | undefined | null` — `null` when `se` has no snapshot (`system`, `mainFocus` and `repRange` all absent).
  - `fillFromPlan(sets: SetRow[], plan: PlannedSet[]): { id: string; patch: { weightKg?: number; reps?: number } }[]` exported from `src/db/plannedSets.ts` (pure: per index, skip done rows and fields already set).
  - `TargetChip` props gain `sessionExercise: SessionExercise`.

- [ ] **Step 1: Write failing tests:**

```ts
expect(
  planLabel(
    'pyramid_up',
    [
      { weightKg: 60, reps: 15 },
      { weightKg: 65, reps: 11 },
      { weightKg: 70, reps: 6 },
    ],
    'kg',
  ),
).toBe('Pyramid ▲ · 60→70 kg × 15→6');
expect(planLabel('progression', Array(5).fill({ weightKg: 80, reps: 5 }), 'kg')).toBe(
  'Progression · 80 kg × 5',
);
expect(planLabel('pitt_force', [{ reps: 20 }], 'kg')).toBe('PITT-Force · 20 reps');
expect(planLabel('pyramid_down', [{ reps: 8 }, { reps: 12 }], 'kg')).toBe('Pyramid ▼ · 8→12 reps');
// fillFromPlan
expect(
  fillFromPlan(
    [row({ reps: 15, weightKg: 60 }), row({ reps: 0 }), row({ reps: 0, completedAt: 1 })],
    [
      { weightKg: 60, reps: 15 },
      { weightKg: 65, reps: 11 },
      { weightKg: 70, reps: 6 },
    ],
  ),
).toEqual([{ id: 'r1', patch: { weightKg: 65, reps: 11 } }]);
expect(fillFromPlan([row({ reps: 9 })], [{ weightKg: 50, reps: 12 }])).toEqual([
  { id: 'r0', patch: { weightKg: 50 } },
]);
```

- [ ] **Step 2:** Run the two test files — FAIL.
- [ ] **Step 3:** Implement. In `TargetChip`, when `useSetPlan` returns an array: show `planLabel`, `title`/reason = `SYSTEM_INFO[system].hint`, tap applies `fillFromPlan` via `setsRepo.updateSet`. When it returns `null`: keep today's `nextTarget` branch unchanged. Same `data-testid="target-chip"`.
- [ ] **Step 4:** Run `npx vitest run src/analysis src/db` — PASS; `npm run typecheck`.
- [ ] **Step 5:** Commit `feat(workout): system-aware target chip`.

---

### Task 7: System picker in Manage Program

**Files:**

- Modify: `src/components/program/ProgramEditor.tsx`
- Test: `e2e/training-systems.spec.ts` (created here; first test)

**Interfaces:**

- Consumes: `edit.setSystem`, `edit.setMainFocus`, `SYSTEM_INFO`, `systemOf` (Task 1); existing `Switch` from `@/components/ui/switch` (add via the project's shadcn pattern if not present — `@radix-ui/react-switch` is already a dependency).
- Produces: DOM hooks used by E2E: `data-testid="system-select"` (native `<select>`, `aria-label="System for {name}"`), switch `aria-label="Main focus for {name}"`, hint `data-testid="system-hint"`.

- [ ] **Step 1: Write the failing E2E test** `'picks a system and main focus in the program editor'`: open Programs, create/duplicate a program, set exercise 1 to Pyramid ▲ → hint text `Start lighter, add weight each set; reps drop.` visible and main-focus switch hidden; set exercise 2 to Progression and toggle main focus on; reload; collapsed summary shows `· Pyramid ▲` and `· Progression ★ main focus`.
- [ ] **Step 2:** Run `npx playwright test e2e/training-systems.spec.ts` — FAIL.
- [ ] **Step 3:** Implement per spec §3 (select options in `TRAINING_SYSTEMS` order with `SYSTEM_INFO[...].label`; read-only summary appends ` · ${short}` and ` ★ main focus`).
- [ ] **Step 4:** Run the test — PASS.
- [ ] **Step 5:** Commit `feat(programs): system picker and main focus in the editor`.

---

### Task 8: Workout card badge and main-focus highlight

**Files:**

- Modify: `src/components/SessionEditor.tsx`
- Test: `e2e/training-systems.spec.ts`

**Interfaces:**

- Consumes: `systemOf`, `SYSTEM_INFO` (Task 1); `session.programDayId`.
- Produces: `data-testid="system-badge"` (text `SYSTEM_INFO[..].short`), `data-testid="main-focus"` (text `★ Main focus`); card class adds `ring-2 ring-primary` when `se.mainFocus`.

- [ ] **Step 1: Write failing E2E** `'program day shows system badges, main focus and pre-filled rows'`: import `examples/programs/ppl-alternating.json` (reuse the import flow from `program-import.spec.ts`), start "Legs #1" → Squat card has `★ Main focus` and badge `Progression`; Leg Press badge `Pyramid ▲` and rep inputs read 15/14/12; an ad-hoc exercise added via Add exercise has no badge. Then fill Leg Press 100×15, 100×13, 100×12, finish, start "Legs #1" again → Leg Press weights 102.5/100/102.5.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement (badge only when `se.system` is set, or when `session.programDayId` is set and the snapshot has `repRange`).
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat(workout): system badge and main-focus highlight`.

---

### Task 9: PITT timer phase logic

**Files:**

- Create: `src/lib/pittTimer.ts`
- Test: `src/lib/pittTimer.test.ts`

**Interfaces:**

- Produces (exact, from spec §4):

```ts
export interface PittConfig {
  countdownSec: number;
  repSec: number;
  pauseSec: number;
  reps: number;
}
export type PittPhase =
  | { phase: 'countdown'; msLeft: number }
  | { phase: 'rep' | 'pause'; rep: number; msLeft: number }
  | { phase: 'done'; rep: number };
export function pittPhaseAt(elapsedMs: number, c: PittConfig): PittPhase;
export function completedReps(elapsedMs: number, c: PittConfig): number;
export function pittEvents(
  c: PittConfig,
): { atMs: number; kind: 'tick' | 'go' | 'hold' | 'done' }[];
```

`pittEvents` lists every tone for the sound scheduler: ticks at 0, 1000, 2000 ms; `go` at the start of each rep; `hold` at the start of each pause (none after the last rep); `done` at the end of the last rep.

- [ ] **Step 1: Write failing tests** with `c = { countdownSec: 3, repSec: 2, pauseSec: 4, reps: 20 }`:

```ts
expect(pittPhaseAt(0, c)).toEqual({ phase: 'countdown', msLeft: 3000 });
expect(pittPhaseAt(2999, c)).toEqual({ phase: 'countdown', msLeft: 1 });
expect(pittPhaseAt(3000, c)).toEqual({ phase: 'rep', rep: 1, msLeft: 2000 });
expect(pittPhaseAt(5000, c)).toEqual({ phase: 'pause', rep: 1, msLeft: 4000 });
expect(pittPhaseAt(9000, c)).toEqual({ phase: 'rep', rep: 2, msLeft: 2000 });
// last rep starts at 3000 + 19*6000 = 117000, ends 119000, no trailing pause
expect(pittPhaseAt(118999, c)).toEqual({ phase: 'rep', rep: 20, msLeft: 1 });
expect(pittPhaseAt(119000, c)).toEqual({ phase: 'done', rep: 20 });
expect(completedReps(4000, c)).toBe(0);
expect(completedReps(5000, c)).toBe(1);
expect(completedReps(8000, c)).toBe(1);
expect(completedReps(500000, c)).toBe(20);
const e = pittEvents({ ...c, reps: 2 });
expect(e).toEqual([
  { atMs: 0, kind: 'tick' },
  { atMs: 1000, kind: 'tick' },
  { atMs: 2000, kind: 'tick' },
  { atMs: 3000, kind: 'go' },
  { atMs: 5000, kind: 'hold' },
  { atMs: 9000, kind: 'go' },
  { atMs: 11000, kind: 'done' },
]);
expect(pittPhaseAt(4000, { countdownSec: 3, repSec: 1, pauseSec: 3, reps: 5 })).toEqual({
  phase: 'pause',
  rep: 1,
  msLeft: 3000,
});
```

- [ ] **Step 2:** Run `npx vitest run src/lib/pittTimer.test.ts` — FAIL.
- [ ] **Step 3:** Implement (arithmetic only; no timers).
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat(pitt): pure timer phase logic`.

---

### Task 10: PITT timer component, sound, wake lock and settings

**Files:**

- Create: `src/lib/pittSound.ts`
- Create: `src/components/workout/PittTimer.tsx`
- Create: `src/components/workout/PittTimer.test.tsx`
- Modify: `src/components/SessionEditor.tsx` (render between note and set rows when `systemOf(se) === 'pitt_force'`)
- Modify: `src/pages/SettingsPage.tsx` ("PITT-Force timer" section)
- Test: `e2e/training-systems.spec.ts`

**Interfaces:**

- Consumes: `pittPhaseAt`, `completedReps`, `pittEvents` (Task 9); `usePittSettings`, `setPittSettings` (Task 3); `setsRepo.updateSet`; `isPaused`.
- Produces:
  - `createPittSound(): { schedule(events: { atMs: number; kind: 'tick' | 'go' | 'hold' | 'done' }[]): void; cancel(): void } | null` — `null` when `AudioContext` is unavailable; must be called inside the Start click handler. Tone table in Global Constraints. `cancel()` stops every scheduled oscillator.
  - `<PittTimer session={Session} sets={SetRow[]} plannedReps={number} />` with test ids `pitt-start`, `pitt-stop`, `pitt-phase` (text `GO`/`HOLD`/`3`/`2`/`1`), `pitt-rep` (text `Rep n / N`), `pitt-mute` (`aria-pressed` = muted), `pitt-log` (text `Log n reps`).

Behaviour: target `N` = reps of the first set with `completedAt === undefined` (fallback `plannedReps`); Start disabled when no such set. On done → `updateSet(firstOpen.id, { reps: N })`. On Stop → show `pitt-log`; clicking writes `completedReps`. When the session becomes paused → behave as Stop. Mute toggles `setPittSettings({ sound })` and, if running, cancels/reschedules remaining events. Wake lock via `navigator.wakeLock?.request('screen')`, released on stop/done/unmount; errors ignored. Unmount → `cancel()` + release.

- [ ] **Step 1: Write failing component tests** (Vitest + jsdom, `vi.useFakeTimers()`, stub `AudioContext` with a spy recording oscillator `start`/`stop`, stub `navigator.wakeLock`):
  - `'Start is disabled when every set is done'` (Review Focus 4).
  - `'counts reps and fills N reps on done'` — advance 3000 + 19·6000 + 2000 ms → `updateSet` called once with `{ reps: 20 }`.
  - `'Stop offers Log n reps'` — advance 3000 + 2000 + 4000 + 2000 ms, click Stop → `Log 2 reps`; click → `updateSet(..., { reps: 2 })`.
  - `'unmount cancels tones and releases the wake lock'` (Review Focus 5) — start, unmount → every started oscillator had `stop` called, sentinel `release` called.
  - `'muted schedules no tones'` — `pittSound: false` → no oscillator created.
  - `'pausing the workout stops the timer'` — rerender with `session.pausedAt` set → `pitt-log` shown, oscillators stopped.
- [ ] **Step 2:** Run `npx vitest run src/components/workout` — FAIL.
- [ ] **Step 3:** Implement component, sound module and Settings section (two number inputs 1–10 with `aria-label` "Rep seconds" / "Pause seconds", one Switch "Timer sound").
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Add E2E** `'PITT timer counts, stops early and logs reps; mute persists'`: `page.clock.install()`, `addInitScript` stub for `AudioContext`; start Legs #1 → Lying Leg Curl `pitt-start` → `clock.runFor(9000)` → `pitt-rep` reads `Rep 2 / 20` → Stop → `pitt-log` reads `Log 1 reps` (rep 1 finished at 5000 ms, rep 2 still running) → click → that set's reps input = 1; click `pitt-mute`, reload, `aria-pressed="true"`. Run `npx playwright test e2e/training-systems.spec.ts` — PASS.
- [ ] **Step 6:** Commit `feat(pitt): pacing timer with two-tone sound, wake lock and settings`.

---

### Task 11: Full verification

- [ ] **Step 1:** Run `npm run check` — expect typecheck, lint and all Vitest suites green.
- [ ] **Step 2:** Run `npm run e2e` — expect all Playwright specs green (existing `program-import.spec.ts` expectations about the Leg Curl note text must be updated to the new note `pause 3–4 s each` if they asserted the old text).
- [ ] **Step 3:** Run `npm run build` — the service-worker build succeeds with no new precache assets beyond code.
- [ ] **Step 4:** Commit any test-expectation fixes `test: align existing specs with training systems`.
