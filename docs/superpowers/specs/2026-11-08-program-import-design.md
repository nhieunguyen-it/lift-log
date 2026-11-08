# Program import, per-exercise notes and 10 catalog exercises — design

Date: 2026-11-08
Status: approved in chat, awaiting written-spec review

## Goal

Let a user bring a training plan into Lift-Log from a file, without touching their history. The
first real use is a coach's 6-day alternating Push/Pull/Legs spreadsheet
(`Van-Nhieu-Nguyen-workout-plan-PPL-alternating.xlsx`), converted by hand into the new format.

The release has four parts:

1. **Program file import**: a dedicated, versioned JSON format (`kind: "program"`) and an
   **Import program** action on the Programs page that _adds_ a program. Export is out of scope.
2. **Per-exercise note**: an optional `note` on program exercises, imported from the file,
   editable in the program editor, snapshotted onto the workout when a day is started.
3. **10 new catalog exercises** so the coach plan maps without approximations.
4. **The coach plan as `examples/programs/ppl-alternating.json`**, validated in CI.

### Success criteria

- Importing `examples/programs/ppl-alternating.json` on a profile with existing sessions creates
  one new program with 6 days and 34 exercises; sessions, sets, settings and other programs are
  unchanged and the active program is unchanged.
- A file with any unknown exercise id, or any shape error, imports nothing and lists every problem.
- Starting "Legs #1" shows "PITT Force – 20 single reps, pause 3–4 s each" under Lying Leg Curl.
- Backups v1–v6 still import; v7 round-trips notes.
- `build-seed` passes with the 10 new exercises (images ≥ 2 each), `SEED_VERSION` 6.

## Decisions (from brainstorming)

| Topic                   | Decision                                                                    |
| ----------------------- | --------------------------------------------------------------------------- |
| Why a new feature       | Backup import replaces all data; there was no way to add just a program     |
| Scope of file feature   | Import only. Export later.                                                  |
| Format                  | Dedicated program file, not the backup format and not the stored `Program`  |
| Unknown exercises       | Catalog/custom ids only; any unknown id fails the whole import              |
| Missing coach exercises | Added to the built-in catalog this release (7 required + 3 closer variants) |
| Coach "System" / notes  | New optional per-exercise `note`; "max" reps = no rep range                 |
| Alternating weeks       | Not modelled; days are ordered by rotation (L1, Pu1, Pl1, L2, Pu2, Pl2)     |
| Name clash on import    | Suffix ` (2)`, ` (3)`, …                                                    |
| Activate on import      | No; user sets it active                                                     |

## 1. Program file format

```json
{
  "app": "lift-log",
  "kind": "program",
  "version": 1,
  "program": {
    "name": "PPL alternating",
    "days": [
      {
        "name": "Legs #1",
        "exercises": [
          {
            "exerciseId": "barbell-back-squat",
            "sets": 5,
            "reps": { "min": 5, "max": 5 },
            "note": "Progression · main focus"
          }
        ]
      }
    ]
  }
}
```

| Field                    | Rule                                                                             |
| ------------------------ | -------------------------------------------------------------------------------- |
| `app`                    | literal `"lift-log"`                                                             |
| `kind`                   | literal `"program"` (so backups and program files can't be confused)             |
| `version`                | literal `1`                                                                      |
| `program.name`           | string, trimmed, 1–80 chars                                                      |
| `program.days`           | 1–14 days                                                                        |
| `days[].name`            | string, trimmed, 1–40 chars                                                      |
| `days[].exercises`       | 1–30 per day                                                                     |
| `exercises[].exerciseId` | non-empty string (resolved in stage 2)                                           |
| `exercises[].sets`       | integer 1–20 (`MIN_TARGET_SETS` / `MAX_TARGET_SETS`)                             |
| `exercises[].reps`       | optional `{ min, max }`, integers 1–100, `min ≤ max`; omitted = exercise default |
| `exercises[].note`       | optional string, trimmed, ≤ 200 chars; empty after trim = absent                 |

All objects are `.strict()`: unknown keys are errors (catches `"set": 5`). Limits live in
`src/config/programFile.ts` (`MAX_FILE_BYTES = 256 * 1024`, name/day/exercise/note limits).

### Validation (two stages, all errors collected)

Pure module `src/program/programFile.ts` (no React/Dexie, respects the portable-core lint boundary):

- `parseProgramFile(text: string): { ok: true; file: ProgramFile } | { ok: false; errors: string[] }`
  - Rejects text longer than `MAX_FILE_BYTES` before `JSON.parse`.
  - Invalid JSON → one error. Zod issues are mapped to readable paths:
    `Day 2 "Legs #2", exercise 4: sets must be between 1 and 20`.
- `findUnknownExercises(file: ProgramFile, known: ReadonlySet<string>): string[]`
  - One message per unknown occurrence: `Day 1 "Legs #1", exercise 4: unknown exercise "leg-curl"`.
  - `known` = merged (built-in + non-deleted custom) exercise ids **excluding cardio**, since
    programs skip cardio.
- `toProgram(file, ids: { programId; dayIds }, now, name): Program` — pure conversion:
  `sets → targetSets`, `reps → repRange`, `note` copied, `builtIn: false`.

The file is untrusted: only parsed as JSON and validated; nothing in it is executed or used as a path.

## 2. Import flow and UI

**Entry point:** an **Import program** button next to **New program** on `ProgramsPage`, wired to a
hidden `<input type="file" accept="application/json,.json">` (same pattern as backup import).
Component: `src/components/program/ImportProgramButton.tsx`.

1. Read file → `parseProgramFile`.
2. Load merged exercises → `findUnknownExercises`.
3. **Errors** → dialog "Can't import this program" listing errors (first 20, then "…and N more").
   Nothing written.
4. **OK** → confirm dialog: program name (after clash renaming), day count, exercise count, each
   day's name and exercise count. Buttons **Import** / **Cancel**.
5. **Import** → `programsRepo.importProgram(file, now)`:
   - one Dexie transaction over `programs` plus the tables `loadMergedExercises` reads
     (`exercises`, `exerciseMuscles`, `customExercises`, `customExerciseMuscles`);
   - re-checks unknown ids (a custom exercise could be deleted between preview and confirm) and
     throws `ProgramImportError` with the messages if any;
   - resolves the name: if a user program has the same name (case-insensitive, trimmed), use
     `Name (2)`, `Name (3)`, … (`uniqueProgramName` pure helper in `programFile.ts`);
   - adds the program with fresh `newId()` ids for program and days, `createdAt = updatedAt = now`;
   - returns the new `Program`.
6. Navigate to `/programs/<id>` with status text "Imported. Set it as active to start using it."

Rules: adds only (never clears anything); active program unchanged; active profile only.

**Errors:** any thrown error in step 5 → "Import failed. Your programs were not changed." and
`console.error`. `ProgramImportError` shows its messages in the error dialog instead.

## 3. Per-exercise note

### Data model (no Dexie schema bump: fields are not indexed)

- `ProgramExercise.note?: string` (`src/program/types.ts`).
- `SessionExercise.note?: string` (`src/analysis/rows.ts`) — a **snapshot** taken when a program
  day starts. Later program edits don't rewrite past workouts; the workout card needs no program
  lookup.
- Shared rule: trimmed, ≤ `NOTE_MAX = 200` chars, empty → property removed.

### Propagation

- `startProgramDay` passes `pe.note` to `sessionsRepo.addExercise(sessionId, exerciseId, note?)`,
  which stores it when present. Block weeks keep notes already (`applyBlockWeek` spreads `...e`).
- `duplicateProgram` copies `note`.
- Move, set-count change, rep-range change and **swap** keep the note (it describes the slot);
  `edit.addExercise` (manual add) starts without one.
- New pure helper `edit.setNote(p, dayId, index, note)` applies the trim/empty/length rule.

### UI

- **ProgramEditor:** per exercise row an "Add note" / "Edit note" text button toggles an inline
  `Input` (`maxLength=200`), saved on blur or Enter via `updateProgram(… edit.setNote …)`.
  When set, the note is shown under the row in `text-muted-foreground text-sm`.
- **SessionEditor (workout card):** read-only note under the exercise name next to `TargetChip`,
  muted small text, wraps. History's session view uses the same component, so it shows there too.

### Backup v7

- `BACKUP_VERSION = 7`; `version` union accepts 1–7.
- `ProgramSchema.days[].exercises[]` and `SessionExerciseSchema` gain `note` (optional, ≤ 200).
- v1–v6 files import unchanged (no notes). New fixture `src/db/__fixtures__/backup-v7.json` and
  `backupV7.test.ts`. README "Backup" section gets a v7 paragraph.

## 4. Catalog additions (10)

Via `data/curation.json` → `scripts/fetch-images.mjs` → `scripts/optimize-images.mjs` →
`scripts/build-seed.mjs`; `SEED_VERSION` 5 → 6. Isolation lifts get an "ISOLATION EXCEPTION"
line in `data/CURATION.md`, non-default weights get their reason.

| id                                  | Source (free-exercise-db)      | Muscles (`m`)                                       | Aliases                          |
| ----------------------------------- | ------------------------------ | --------------------------------------------------- | -------------------------------- |
| `lying-leg-curl`                    | Lying_Leg_Curls                | hamstrings, calves:.25                              | leg curl, hamstring curl         |
| `dumbbell-fly`                      | Dumbbell_Flyes                 | chest, front_delts:.5                               | flye, chest fly                  |
| `barbell-curl`                      | Barbell_Curl                   | biceps, forearms:.25                                | bicep curl, biceps curl          |
| `dumbbell-preacher-curl`            | Two-Arm_Dumbbell_Preacher_Curl | biceps, forearms:.25                                | scott curl, preacher curl        |
| `hammer-curl`                       | Hammer_Curls                   | biceps, forearms:.5                                 | neutral grip curl                |
| `lying-triceps-press`               | Lying_Triceps_Press            | triceps                                             | french press, skull crusher      |
| `seated-dumbbell-triceps-extension` | Seated_Triceps_Press           | triceps                                             | overhead triceps extension       |
| `stiff-leg-deadlift`                | Stiff-Legged_Barbell_Deadlift  | hamstrings, glutes:.75, lower_back:.5, forearms:.25 | stiffleg, stiff-legged deadlift  |
| `underhand-lat-pulldown`            | Underhand_Cable_Pulldowns      | lats, biceps:.75, upper_back:.5                     | reverse grip pulldown, undergrip |
| `reverse-machine-fly`               | Reverse_Machine_Flyes          | rear_delts, upper_back:.5                           | reverse butterfly, rear delt fly |

Weights follow the closest shipped entries (RDL, lat pulldown, dumbbell reverse fly, dumbbell curl,
triceps pushdown). The curator may adjust them during review; reasons go in `CURATION.md`.

## 5. The coach plan (removed)

The coach's plan was converted to a program file during development. It is personal data, so it
is no longer kept in this repository.

## 6. Testing

- `src/program/programFile.test.ts`: valid file; invalid JSON; wrong `app`/`kind`/`version`; every
  limit at and over the edge; unknown keys; oversized text; all errors collected with readable
  paths; `toProgram` mapping; `uniqueProgramName` (`(2)`, `(3)`, case-insensitive).
- `findUnknownExercises`: unknown id, cardio id, existing custom id, deleted custom id.
- `src/db/programImport.test.ts` (fake-indexeddb): adds without touching sessions/sets/settings/
  other programs; fresh ids; clash rename; active program unchanged; throws and writes nothing if
  an id became unknown.
- Notes: `edit.setNote` (trim, empty, >200); `duplicateProgram` copies; `startProgramDay`
  snapshots, including with a running block; swap/move keep the note.
- Backup: v7 fixture round-trip; existing v1–v6 fixture tests stay green.
- `examples/programs/ppl-alternating.test.ts` (or in `programFile.test.ts`): the example parses and
  has no unknown ids against the shipped seed — catalog drift fails CI.
- Seed: `node scripts/build-seed.mjs` passes; seed tests updated for `SEED_VERSION` 6.
- Playwright `e2e/program-import.spec.ts`: import example → editor opens with 6 days → set active →
  start Legs #1 → card shows the PITT Force note; import a broken file → error dialog, no program
  added.

## Out of scope

Program export; spreadsheet/CSV import; AMRAP as a first-class target; modelling alternating
weeks or a schedule; a sharing link; importing custom exercise definitions from a file.
