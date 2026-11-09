# Training systems (Progression, Pyramid ▲/▼, PITT-Force) — design

Date: 2026-11-09
Status: approved in chat, awaiting written-spec review

## Goal

Turn the coach plan's **System** column (`Van-Nhieu-Nguyen-workout-plan-PPL-alternating.xlsx`,
column D) into real behaviour in Lift-Log instead of free-text notes:

1. **Pick a system per program exercise** in Manage Program (default: Progression).
2. **Pre-fill set rows** with system-aware weight and reps when a program day is started.
3. **PITT-Force pacing timer** on the workout screen: two-tone "GO / HOLD" sounds per paused rep,
   with a mute toggle.

The coach's definitions (from the sheet):

- **Progression**: same weight in every set; raise the weight only when every working set hit
  all reps with good form. Otherwise stay at that weight.
- **Progression with main focus**: same rules; this is the most important exercise of the day.
- **Pyramide ▲**: start light, add weight each set; reps drop.
- **Pyramide ▼**: start heavy, reduce weight each set; reps rise.
- **PITT-Force**: one set of 20 single reps, pausing 3–4 s between reps.
- **No system**: just complete the rep range (treated as Progression).

### Success criteria

- A program exercise can be set to any of the four systems (plus main focus on Progression) in
  the program editor; the choice survives reload, duplication, backup v8 round-trip and the
  program file import.
- Starting a program day creates set rows already holding the planned weight and reps per set
  (weight blank when there is no history or the move is pure bodyweight).
- On a second "Legs #1" session after logging Leg Press 3 × (15, 13, 12) at 100 kg on every set,
  the pre-filled Pyramid ▲ rows read 15 / 14 / 12 reps; each set's weight is 100 kg plus one step
  if that set hit its slot's reps, else 100 kg.
- Lying Leg Curl (PITT-Force) shows a timer; Start → countdown → alternating GO / HOLD tones with
  "Rep n / 20"; finishing fills 20 reps into the first open set; Stop offers "Log n reps".
- Muting the timer persists across sessions; Settings can change rep/pause seconds and sound.
- Backups v1–v7 still import (no systems); `npm run check` and `npm run e2e` pass.

## Decisions (from brainstorming)

| Topic                 | Decision                                                                       |
| --------------------- | ------------------------------------------------------------------------------ |
| Where system lives    | Per program exercise (like the sheet's column D); snapshot onto the session    |
| Main focus            | A flag on Progression, visual only (no different maths)                        |
| No system             | Treated as Progression; Progression is stored as "key absent"                  |
| Applying suggestions  | Pre-fill set rows when the day starts (not placeholders, not chip-only)        |
| PITT pacing           | Two-tone: "GO" tone at rep start, "HOLD" tone at pause start, rep counter      |
| Architecture          | Approach A: pure `planSets` planner in the recommend engine + session snapshot |
| Progression on misses | Hold the weight; no automatic deload in pre-fill (deload hint stays separate)  |
| Pyramid weights       | Per set slot vs. the same slot last session                                    |
| Sound                 | Generated Web Audio tones, no audio assets                                     |
| Ad-hoc exercises      | No system; behave exactly as today                                             |

## Non-goals

- Systems on ad-hoc (non-program) exercises or on custom-exercise defaults.
- Changing the built-in program templates.
- Program file export, new program-file version, or a new Dexie schema version.
- Vibration, voice cues, or background audio while the app is not visible.
- Automatic RIR pre-fill.

## 1. Data model

### Types (`src/program/types.ts`)

```ts
export const TRAINING_SYSTEMS = [
  'progression',
  'pyramid_up',
  'pyramid_down',
  'pitt_force',
] as const;
export type TrainingSystem = (typeof TRAINING_SYSTEMS)[number];

export interface ProgramExercise {
  exerciseId: string;
  targetSets: number;
  repRange?: RepRange;
  note?: string;
  /** Absent = 'progression'. Never stored as 'progression'. */
  system?: Exclude<TrainingSystem, 'progression'>;
  /** Only allowed when the system is progression (i.e. `system` absent). */
  mainFocus?: true;
}
```

`mainFocus` is stored only as `true` (absent = false), matching how `note` is dropped when empty.

### Session snapshot (`src/analysis/rows.ts`)

`SessionExercise` gains `system?` and `mainFocus?` with the same types. `startProgramDay` copies
both from the (block-applied) program exercise, the same way it copies `note`. A program day
started session also stores the planned `repRange` on the snapshot (`repRange?: RepRange`) so the
target chip and PITT timer plan from the program's range even if the program is edited later.
Fields are not indexed, so **no Dexie version bump**.

Helper: `systemOf(x: { system?: ... }): TrainingSystem` returns `x.system ?? 'progression'`.

### Program file (`src/program/programFile.ts`)

File version stays `1`. Each exercise accepts two new optional fields:

- `system`: one of `"progression" | "pyramid_up" | "pyramid_down" | "pitt_force"`.
  Error text: `system must be one of progression, pyramid_up, pyramid_down, pitt_force`.
- `mainFocus`: boolean. `true` with a system other than progression fails with
  `mainFocus is only allowed with the progression system`.

`toProgram` maps `"progression"` to "key absent" and `mainFocus: false` to "key absent".
Errors keep the existing `Day n "name", exercise m:` prefix.

`examples/programs/ppl-alternating.json` is rewritten to use `system` / `mainFocus` for every
exercise that has a system in the sheet. Notes keep only real cues (e.g. "pause 3–4 s each",
"each leg 10 reps"); notes that only named the system are removed.

### Backup v8 (`src/db/backup.ts`)

`BACKUP_VERSION = 8`. `ProgramSchema` exercises and the session-exercise schema accept `system`
(enum without `'progression'`), `mainFocus` (`z.literal(true)`), and session `repRange`. Settings
accept `pittRepSec`, `pittPauseSec`, `pittSound`. v1–v7 still parse (fields simply absent).
Needed because `z.object` strips unknown keys: without the bump a restore silently loses systems.

### Settings (`src/db/settingsRepo.ts`)

| Key            | Type    | Default | Range |
| -------------- | ------- | ------- | ----- |
| `pittRepSec`   | integer | 2       | 1–10  |
| `pittPauseSec` | integer | 4       | 1–10  |
| `pittSound`    | boolean | true    | —     |

Exposed through a `usePittSettings()` hook and `setPittSettings(patch)`; constants live in
`src/config/training.ts` (`TRAINING.pitt`).

## 2. Set planner (`src/analysis/recommend/systems.ts`)

```ts
export interface PlannedSet {
  weightKg?: number;
  reps: number;
}

export function planSets(args: {
  system: TrainingSystem;
  repRange: RepRange; // program range, else repRangeFor(exercise)
  sets: number; // planned set count (block-applied)
  history: SetRow[]; // working sets of the most recent earlier session, ordered
  exercise: Exercise;
  primaryMuscleIds: MuscleId[];
  unit: WeightUnit;
  deloadWeek?: boolean;
  config?: TrainingConfig;
}): PlannedSet[];
```

Pure, no Dexie. `loadable()` and `stepped()` in `progression.ts` are exported for reuse (weight
steps by load-step category and unit, rounded to a loadable value). Warm-up sets are excluded
from `history` by the caller. RIR is never planned.

**Common rules**

- `step(w)` = `stepped(w, category, unit)`; `stepDown(w)` = the same step subtracted, floored at 0.
- **No history** (`history` empty): reps per the system's rep rule, `weightKg` undefined.
- **Pure bodyweight** (`exercise.isBodyweight` and no history set has weight > 0): `weightKg`
  undefined on every set; reps per the rules below.
- **Deload week**: every "step up" becomes "hold" (same weight).

**Rep shapes** for `n = sets`, range `[min, max]`:

- `flat(r)`: every set `r`.
- `descending`: set `i` (0-based) = `Math.round(max − (max − min) · i / (n − 1))`; `n = 1` → `max`.
  Example 5 × 15→6: 15, 13, 11, 8, 6.
- `ascending`: set `i` = `Math.round(min + (max − min) · i / (n − 1))`; `n = 1` → `min`.
  Example 4 × 8→12: 8, 9, 11, 12.

| System       | Reps                                                                                                                                          | Weight                                                                                                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| progression  | `allTop` → `flat(min)`; else `flat(min(max, minReps + 1))` where `minReps` = lowest reps last session. Fixed range (min = max) → `flat(max)`. | `W` = heaviest working weight last session. `allTop` = every history set has reps ≥ `max` **and** history has ≥ `sets` sets → `step(W)`; else `W`.                                          |
| pyramid_up   | `descending`                                                                                                                                  | Per slot `i`: if history has slot `i` → its weight, `step`ped if its reps ≥ today's planned reps for slot `i`. Missing slot → previous planned slot's weight `step`ped (undefined if none). |
| pyramid_down | `ascending`                                                                                                                                   | Same as pyramid_up, but a missing slot uses previous planned slot's weight `stepDown`ed.                                                                                                    |
| pitt_force   | `flat(max)`                                                                                                                                   | As progression: `step(W)` only when every history set hit `max` and history has ≥ `sets` sets; else `W`.                                                                                    |

PITT-Force with no range uses `20–20`.

### Callers

- **`startProgramDay`** (`src/db/programsRepo.ts`): for each exercise, loads history with the
  existing `earlierSessionExerciseIds` + ordered sets (working only), calls `planSets`, and
  `bulkAdd`s rows with `weightKg` / `reps` set (keys omitted when undefined). Deload week =
  `isDeloadWeek(block, blockWeek)` when a block runs.
- **`TargetChip`** (`src/components/recommend/TargetChip.tsx`): when the session exercise has a
  snapshot (`programDayId` session and a `repRange`/`system` on the snapshot), it computes the
  plan via a `useSetPlan(sessionExerciseId)` hook and:
  - label: `"<System> · <first weight>→<last weight> <unit> × <first reps>→<last reps>"`
    (collapsed to `"<System> · 80 kg × 5"` when flat; weight part omitted when undefined);
  - tap: for each row in order that is not done and still empty (`reps === 0` or weight
    undefined when the plan has a weight), fills only its empty fields from the plan slot with
    the same index. Typed values are never overwritten. No new rows are added.
  - Sessions/exercises without a snapshot keep today's `nextTarget` behaviour unchanged.
- **Add set** keeps today's `pickPrefill` (copy the last row).
- `ExerciseDeloadHint` is unchanged.

## 3. Manage Program UI (`src/components/program/ProgramEditor.tsx`)

Edit mode, per exercise row, after the sets stepper and `RepRangeFields`:

- **System** native `<select>` (`aria-label="System for {name}"`, `data-testid="system-select"`):
  Progression / Pyramid ▲ (light → heavy) / Pyramid ▼ (heavy → light) / PITT-Force.
- **Main focus** Radix `Switch` (`aria-label="Main focus for {name}"`), shown only for
  Progression.
- A one-line muted hint under the select, from `SYSTEM_INFO` in `src/program/systems.ts`:
  - Progression: "Same weight every set. Add weight once every set hits the top reps."
  - Pyramid ▲: "Start lighter, add weight each set; reps drop."
  - Pyramid ▼: "Start heavy, drop weight each set; reps rise."
  - PITT-Force: "Single paused reps with 3–4 s rest; the timer paces you."
- Choosing PITT-Force when `repRange` is undefined sets it to `20–20`.

Pure helpers in `src/program/edit.ts`:

- `setSystem(p, dayId, index, system)`: `'progression'` deletes `system`; any other value sets it
  and deletes `mainFocus`.
- `setMainFocus(p, dayId, index, on)`: no-op unless the system is progression; `false` deletes
  the key.

Read-only summary: `"5 sets, 5-5 reps · Progression ★ main focus"`, `"3 sets, 12-15 reps ·
Pyramid ▲"`. Labels come from `SYSTEM_INFO`. Built-in templates are unchanged (no system).
Duplication already spreads exercise fields; a test confirms the new fields survive.

## 4. Workout screen and PITT-Force timer

### Exercise card (`src/components/SessionEditor.tsx`)

- System badge next to the name for snapshots with a system other than progression, and for
  progression only when the session was started from a program day (ad-hoc cards get none).
- Main focus: card gets `ring-2 ring-primary` and a "★ Main focus" label
  (`data-testid="main-focus"`).
- `PittTimer` renders between the note and the set rows when `systemOf(se) === 'pitt_force'`.

### Timer logic (`src/lib/pittTimer.ts`, pure)

```ts
export interface PittConfig {
  countdownSec: number;
  repSec: number;
  pauseSec: number;
  reps: number;
}
export type PittPhase =
  | { phase: 'countdown'; msLeft: number }
  | { phase: 'rep' | 'pause'; rep: number; msLeft: number } // rep is 1-based
  | { phase: 'done'; rep: number };
export function pittPhaseAt(elapsedMs: number, c: PittConfig): PittPhase;
export function completedReps(elapsedMs: number, c: PittConfig): number;
```

Timeline: countdown (3 s) → for each rep k = 1..reps: `rep` phase (`repSec`) then `pause` phase
(`pauseSec`), except no pause after the last rep → `done`. `completedReps` counts reps whose rep
phase has fully elapsed. Time-based (elapsed from a start timestamp), so it never drifts.

### Component (`src/components/workout/PittTimer.tsx`)

- Idle: **Start** button and the 🔊/🔇 toggle. Target reps = reps of the first not-done set of
  this exercise (fallback: planned max, 20).
- Running: large "GO" / "HOLD" (countdown shows 3-2-1) with seconds left, "Rep n / N"
  (`data-testid="pitt-rep"`), **Stop**. UI ticks every 100 ms from `performance.now()`.
- Done: two-note chime; writes `reps = N` into the first not-done set (`setsRepo.updateSet`);
  the user ticks Done themselves.
- Stop early: timer halts and shows **Log n reps** (n = `completedReps`), which writes `reps = n`
  into the first not-done set; dismissing discards.
- Workout paused (`isPaused(session)`) → the timer stops as if Stop was pressed.
- Mute toggle writes `pittSound` (persists).

### Sound (`src/lib/pittSound.ts`)

Web Audio API, created/resumed inside the Start click (iOS unlock). Tones via `OscillatorNode` +
short gain envelope, scheduled on `AudioContext.currentTime` for the whole run at Start (and
cancelled on Stop):

- countdown tick: 660 Hz, 60 ms
- GO: 880 Hz, 150 ms
- HOLD: 440 Hz, 150 ms
- done: 880 Hz then 1320 Hz, 120 ms each

No audio files, nothing new for the service worker to cache. When `pittSound` is false nothing is
scheduled. If `AudioContext` is unavailable the timer still runs silently.

### Screen wake lock

`navigator.wakeLock.request('screen')` while running, released on stop/done/unmount; ignored if
unsupported or rejected. Known limit: if the app is backgrounded, iOS may suspend audio; on return
the counter resyncs from elapsed time.

### Settings page (`src/pages/SettingsPage.tsx`)

New "PITT-Force timer" section: Rep seconds (1–10), Pause seconds (1–10), Sound switch.

## 5. Testing

**Unit (Vitest, pure)**

- `src/analysis/recommend/systems.test.ts`: per system — no history; hold vs step; range +1 rep;
  bodyweight blank weight; descending/ascending rep shapes for n = 1, 2, 4, 5; per-slot step only
  when slot hit; missing slot ± step; history with fewer sets than planned blocks a progression
  step; deload week never steps; program range overrides exercise default; PITT default 20.
- `src/lib/pittTimer.test.ts`: phase/rep/msLeft at countdown end, rep→pause, pause→next rep,
  last rep (no trailing pause), done; `completedReps` mid-rep and mid-pause; custom seconds.
- `src/program/edit.test.ts`: `setSystem` / `setMainFocus` rules; progression deletes the key;
  leaving progression clears main focus.
- `src/program/programFile.test.ts`: valid system/mainFocus; unknown system and mainFocus with a
  non-progression system give the documented errors; `toProgram` normalisation.
- `src/program/examplePrograms.test.ts`: updated PPL file parses, all ids known, expected systems
  on spot-checked exercises (Squat main focus, Leg Press pyramid_up, Leg Curl pitt_force).

**DB (fake-indexeddb)**

- `startProgramDay` snapshots system/mainFocus/repRange and pre-fills rows from history.
- Backup v8 round-trip keeps systems, session snapshots and PITT settings; a v7 file still
  imports.
- Duplicating a program keeps `system` and `mainFocus`.

**E2E (Playwright, `e2e/training-systems.spec.ts`)**

- Set an exercise to Pyramid ▲ in Manage Program, log a session, start the day again, assert
  pre-filled reps/weights per row.
- PITT timer with `page.clock` and a stubbed `AudioContext`: Start → "Rep 2 / 20" after the
  expected time → Stop → "Log n reps" fills the set; mute persists after reload.

Done when `npm run check` and `npm run e2e` pass.
