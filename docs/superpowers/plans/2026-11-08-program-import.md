# Program Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import a program from a dedicated JSON file (adds, never replaces), add an optional per-exercise note, add 10 catalog exercises, and ship the coach's PPL plan as an example file.

**Architecture:** Pure parsing/validation in `src/program/programFile.ts` (portable core, no React/Dexie). One transactional repo call `programsRepo.importProgram`. Notes live on `ProgramExercise` and are snapshotted onto `SessionExercise` when a program day starts; backup bumps to v7. Catalog additions go through the existing curation → seed pipeline.

**Tech Stack:** React + TypeScript, Vite, Dexie (IndexedDB), zod, Vitest + fake-indexeddb, Playwright, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-11-08-program-import-design.md`

## Global Constraints

- Node via `export PATH=$HOME/.nvm/versions/node/v20.20.2/bin:$PATH` (see `.nvmrc`).
- Gate before every commit: `npm run check` (typecheck + lint + vitest) must pass.
- `src/program/*` is portable core: must not import `@/db`, `@/components/*`, `@/pages/*`, `react`, `dexie`.
- Program file: `app: "lift-log"`, `kind: "program"`, `version: 1`; `.strict()` objects.
- Limits: file ≤ 256 KiB; program name 1–60; days 1–14; day name 1–40; exercises per day 1–30; sets 1–20; reps integers 1–100, `min ≤ max`; note ≤ 200 (trimmed, empty → absent).
- Import adds only; never changes the active program; name clash → `Name (2)`, `Name (3)`, … (case-insensitive, trimmed).
- `BACKUP_VERSION = 7`; v1–v6 still import. `SEED_VERSION = 6`.
- No Dexie schema version bump (new fields are not indexed).
- Copy (exact): button "Import program"; error dialog title "Can't import this program"; overflow line "…and N more"; success status "Imported. Set it as active to start using it."; failure "Import failed. Your programs were not changed."
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **User picks the coach's `.xlsx` (or any non-JSON) file** → one readable error "This file isn't a Lift-Log program file (not valid JSON).", not a raw `SyntaxError`. Test in Task 5.
2. **User picks a Lift-Log backup by mistake** (`app: "lift-log"`, no `kind`, has `sessions`) → "This is a Lift-Log backup. Import it from Settings → Backup." Test in Task 5.
3. **File saved with a UTF-8 BOM** (Windows editors) → parses normally. Test in Task 5.
4. **Same exercise id twice in one day or across days** (Leg Curl is on two days) → allowed, both kept in order. Test in Task 6.
5. **Re-picking the same file after a failed import** → the file input fires again (reset `input.value = ''` after each read). Test in Task 10 (e2e).

---

## File Map

| File                                                                                                                                                     | Responsibility                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `data/curation.json`, `data/CURATION.md`, `public/exercises/<id>/*.jpg`, `src/data/exercises.json`, `src/data/exerciseMuscles.json`, `src/data/index.ts` | 10 new catalog exercises (Task 1)                                                                |
| `src/program/types.ts`, `src/program/edit.ts`                                                                                                            | `note` field, `setNote`, swap keeps note (Task 2)                                                |
| `src/db/programsRepo.ts`                                                                                                                                 | duplicate copies note (Task 2); `startProgramDay` passes note (Task 3); `importProgram` (Task 6) |
| `src/analysis/rows.ts`, `src/db/sessionsRepo.ts`                                                                                                         | `SessionExercise.note`, `addExercise(…, note?)` (Task 3)                                         |
| `src/db/backup.ts`, `src/db/__fixtures__/phase7-export.json`, `src/db/backupV7.test.ts`, `README.md`                                                     | backup v7 (Task 4)                                                                               |
| `src/config/programFile.ts`, `src/program/programFile.ts`                                                                                                | format limits + pure parse/validate/convert (Task 5)                                             |
| `examples/programs/ppl-alternating.json`                                                                                                                 | coach plan (Task 7)                                                                              |
| `src/components/program/ImportProgramButton.tsx`, `src/pages/ProgramsPage.tsx`                                                                           | import UI (Task 8)                                                                               |
| `src/components/program/ProgramEditor.tsx`, `src/components/program/ExerciseNote.tsx`, `src/components/SessionEditor.tsx`                                | note UI (Task 9)                                                                                 |
| `e2e/program-import.spec.ts`                                                                                                                             | end-to-end (Task 10)                                                                             |

---

### Task 1: Ten new catalog exercises

**Files:**

- Modify: `data/curation.json` (append 10 entries), `data/CURATION.md`, `src/data/index.ts` (`SEED_VERSION = 6`), `src/data/seed.test.ts`
- Generated: `src/data/exercises.json`, `src/data/exerciseMuscles.json`, `public/exercises/<id>/0.jpg|1.jpg`

**Interfaces:**

- Produces: catalog ids `lying-leg-curl`, `dumbbell-fly`, `barbell-curl`, `dumbbell-preacher-curl`, `hammer-curl`, `lying-triceps-press`, `seated-dumbbell-triceps-extension`, `stiff-leg-deadlift`, `underhand-lat-pulldown`, `reverse-machine-fly`.

- [ ] **Step 1: Update `src/data/seed.test.ts` first**

  `expect(SEED_VERSION).toBe(6)`; exercise count bound `toBeLessThanOrEqual(100)`; add:

  ```ts
  it('includes the program-import additions', () => {
    const ids = new Set(exercises.map((e) => e.id));
    for (const id of [
      'lying-leg-curl',
      'dumbbell-fly',
      'barbell-curl',
      'dumbbell-preacher-curl',
      'hammer-curl',
      'lying-triceps-press',
      'seated-dumbbell-triceps-extension',
      'stiff-leg-deadlift',
      'underhand-lat-pulldown',
      'reverse-machine-fly',
    ])
      expect(ids.has(id)).toBe(true);
  });
  ```

- [ ] **Step 2: Run `npx vitest run src/data/seed.test.ts`** — Expected: FAIL (SEED_VERSION 5, ids missing).
- [ ] **Step 3: Append the 10 entries to `data/curation.json`** using the existing keys (`src`, `id`, `name`, `eq`, `force`, `mech`, `level`, `al`, `m`, `note`). `src`, `m` and aliases come from spec §4 table verbatim. Take `eq`/`force`/`mech`/`level` from the source record in `data/raw/free-exercise-db.json`, mapping equipment the same way existing entries do (e-z curl bar → the value used by existing EZ-bar entries or `barbell`). Every non-default weight gets a `note` reason.
- [ ] **Step 4: Add to `data/CURATION.md`**: one "ISOLATION EXCEPTION" bullet for each isolation entry (all except `stiff-leg-deadlift`, `underhand-lat-pulldown`) and weight-reason bullets matching the `note`s.
- [ ] **Step 5: Generate** — `node scripts/fetch-images.mjs && node scripts/optimize-images.mjs && node scripts/build-seed.mjs`. Expected: exits 0, coverage printed, 20 new jpgs under `public/exercises/`. Set `SEED_VERSION = 6` in `src/data/index.ts`.
- [ ] **Step 6: Run `npm run check`** — Expected: PASS (fix any other test that pinned the old count/version).
- [ ] **Step 7: Commit** — `git add data src/data public/exercises && git commit -m "feat(catalog): add 10 exercises for program import"`

### Task 2: Note on program exercises

**Files:**

- Modify: `src/program/types.ts`, `src/program/edit.ts:102-108` (`swapExercise`), `src/db/programsRepo.ts:84-93` (`duplicateProgram`)
- Test: `src/program/edit.test.ts`, existing programsRepo test file for duplicate (find with `grep -l duplicateProgram src/db/*.test.ts`)

**Interfaces:**

- Produces: `ProgramExercise.note?: string`; `export const NOTE_MAX = 200` and `export function normalizeNote(note: string | undefined): string | undefined` in `src/program/edit.ts` (trim; empty → `undefined`; longer than `NOTE_MAX` → sliced to `NOTE_MAX`. Only the editor reaches this path; over-long notes in files are rejected earlier by the schema); `export function setNote(p: Program, dayId: string, index: number, note: string | undefined): Program`.

- [ ] **Step 1: Write failing tests in `edit.test.ts`**
  - `setNote` stores `'Pyramide ▲'` from `'  Pyramide ▲  '`.
  - `setNote` with `'   '` or `undefined` removes the `note` key (`expect('note' in ex).toBe(false)`).
  - `setNote` with 250 chars stores exactly 200.
  - `swapExercise` keeps `note` and `targetSets`, drops `repRange` (existing behaviour).
  - `moveExercise`, `setTargetSets`, `setRepRange` keep `note`.
- [ ] **Step 2: Duplicate test** — `duplicateProgram` of a user program whose exercise has `note: 'x'` → copy has `note: 'x'`.
- [ ] **Step 3: Run `npx vitest run src/program/edit.test.ts`** — Expected: FAIL (`setNote` not exported).
- [ ] **Step 4: Implement** `note?` in `types.ts`; `NOTE_MAX`, `normalizeNote`, `setNote` in `edit.ts` (omit the key when normalized is `undefined`, same pattern as `setRepRange`); `swapExercise` returns `{ exerciseId, targetSets, ...(e.note ? { note: e.note } : {}) }`. `duplicateProgram` already spreads `...e`; confirm the test passes.
- [ ] **Step 5: Run `npm run check`** — Expected: PASS.
- [ ] **Step 6: Commit** — `feat(program): optional per-exercise note`

### Task 3: Snapshot the note onto the workout

**Files:**

- Modify: `src/analysis/rows.ts:13-18`, `src/db/sessionsRepo.ts:64-71`, `src/db/programsRepo.ts:185` (`startProgramDay` loop)
- Test: the existing `startProgramDay` test file (`grep -l startProgramDay src/db/*.test.ts`)

**Interfaces:**

- Consumes: `ProgramExercise.note` (Task 2).
- Produces: `SessionExercise.note?: string`; `addExercise(sessionId: string, exerciseId: string, note?: string): Promise<SessionExercise>` — stores `note` only when it is a non-empty string.

- [ ] **Step 1: Failing tests**
  - Program day with exercise `{ exerciseId: 'deadlift', targetSets: 3, note: 'Progression · main focus' }` → after `startProgramDay`, the session exercise row has that `note`.
  - Same with a running block (use the existing block test helper) → note still present.
  - Exercise without note → row has no `note` key.
  - Later `updateProgram(… setNote(…, 'changed'))` does not change the existing session exercise's note.
- [ ] **Step 2: Run** the file — Expected: FAIL.
- [ ] **Step 3: Implement** the field, the `addExercise` parameter, and pass `pe.note` in `startProgramDay`.
- [ ] **Step 4: Run `npm run check`** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(workout): snapshot program note onto session exercise`

### Task 4: Backup v7

**Files:**

- Modify: `src/db/backup.ts` (`BACKUP_VERSION = 7`, version union adds `z.literal(6)`, `note` on `SessionExerciseSchema` and `ProgramSchema` exercises), `README.md` Backup section
- Create: `src/db/__fixtures__/phase7-export.json`, `src/db/backupV7.test.ts`

**Interfaces:**

- Consumes: `note` fields from Tasks 2–3; `NOTE_MAX` from `@/program/edit`.

- [ ] **Step 1: Create the fixture** — copy `phase6-export.json`, set `version: 7`, add `note` to one session exercise and one program exercise.
- [ ] **Step 2: Write `backupV7.test.ts`** (same `wipe` pattern as `backupV6.test.ts`):
  - `parseBackup(fixture)` ok; `importData` then `exportData` → both notes round-trip and `version === 7`.
  - A note of 201 chars → `parseBackup` returns `ok: false`.
  - v6 fixture still imports; imported rows have no `note`.
- [ ] **Step 3: Run** — Expected: FAIL (version 7 rejected).
- [ ] **Step 4: Implement** the schema changes (`note: z.string().trim().min(1).max(NOTE_MAX).optional()`), add the README v7 paragraph: "Backup format **v7** adds optional per-exercise notes on programs and on workout exercises. v1–v6 still import."
- [ ] **Step 5: Run `npm run check`** — Expected: PASS (v1–v6 tests unchanged).
- [ ] **Step 6: Commit** — `feat(backup): v7 with exercise notes`

### Task 5: Program file parser (pure)

**Files:**

- Create: `src/config/programFile.ts`, `src/program/programFile.ts`, `src/program/programFile.test.ts`
- Modify: `src/program/index.ts` (re-export)

**Interfaces:**

- Consumes: `NOTE_MAX`, `MIN_TARGET_SETS`, `MAX_TARGET_SETS` from `./edit`; `Program` from `./types`.
- Produces:

  ```ts
  // src/config/programFile.ts
  export const PROGRAM_FILE = {
    maxBytes: 256 * 1024,
    nameMax: 80,
    daysMax: 14,
    dayNameMax: 40,
    exercisesPerDayMax: 30,
    repsMax: 100,
  } as const;
  // src/program/programFile.ts
  export type ProgramFile = z.infer<typeof ProgramFileSchema>;
  export type ParseProgramFileResult =
    { ok: true; file: ProgramFile } | { ok: false; errors: string[] };
  export function parseProgramFile(text: string): ParseProgramFileResult;
  export function findUnknownExercises(file: ProgramFile, known: ReadonlySet<string>): string[];
  export function uniqueProgramName(name: string, existing: readonly string[]): string;
  export function toProgram(
    file: ProgramFile,
    ids: { programId: string; dayIds: string[] },
    name: string,
    now: number,
  ): Program;
  ```

- [ ] **Step 1: Write `programFile.test.ts`** with a `valid()` builder (1 day, 1 exercise). Cases and exact assertions:
  - valid → `ok: true`; names and notes are trimmed; whitespace-only note → no `note` key.
  - **BOM**: `'﻿' + JSON.stringify(valid())` → `ok: true`.
  - **Non-JSON** (`'PK\u0003\u0004…'`) → `errors` equals `["This file isn't a Lift-Log program file (not valid JSON)."]`.
  - **Backup picked**: `{ app: 'lift-log', version: 6, sessions: [] }` → `errors` equals `["This is a Lift-Log backup. Import it from Settings → Backup."]`.
  - wrong `app`, `kind`, `version` → one error each naming the field.
  - text longer than 256 KiB → `["This file is too large (max 256 KB)."]`, `JSON.parse` not reached.
  - limits at edge pass and one over fail: name 80/81, 14/15 days, day name 40/41, 30/31 exercises, sets 1/0 and 20/21, reps 1–100 / 101, `min > max`, note 200/201.
  - unknown key `set: 5` → error contains `exercise 1` and `set`.
  - two bad exercises in different days → both errors reported, each prefixed `Day N "<day name>", exercise M:`.
  - `findUnknownExercises` with `known = {'deadlift'}` and ids `['deadlift','leg-curl']` → `['Day 1 "Legs #1", exercise 2: unknown exercise "leg-curl"']`.
  - `uniqueProgramName('PPL', ['ppl', 'PPL (2)'])` → `'PPL (3)'`; `uniqueProgramName('PPL', [])` → `'PPL'`.
  - `toProgram` maps `sets→targetSets`, `reps→repRange`, copies `note`, `builtIn: false`, `createdAt === updatedAt === now`, day ids from `ids.dayIds` in order.
- [ ] **Step 2: Run `npx vitest run src/program/programFile.test.ts`** — Expected: FAIL (module missing).
- [ ] **Step 3: Implement.** Order in `parseProgramFile`: size check on `text.length` → strip leading BOM → `JSON.parse` (catch → non-JSON message) → backup detection (`app === 'lift-log'` and `'sessions' in obj` and no `kind`) → `ProgramFileSchema.safeParse` → map every zod issue to `Day N "name", exercise M: <field> <message>` (fall back to the zod path for top-level fields). Schema uses `.strict()` on every object.
- [ ] **Step 4: Run `npm run check`** — Expected: PASS (lint confirms no forbidden imports).
- [ ] **Step 5: Commit** — `feat(program): program file parser and validator`

### Task 6: `importProgram` repo call

**Files:**

- Modify: `src/db/programsRepo.ts`
- Create: `src/db/programImport.test.ts`

**Interfaces:**

- Consumes: Task 5 functions; `loadMergedExercises`, `isCardio`, `newId`.
- Produces:

  ```ts
  export class ProgramImportError extends Error { constructor(readonly errors: string[]) }
  export async function knownProgramExerciseIds(): Promise<Set<string>>; // merged, non-cardio
  export async function previewImportName(name: string): Promise<string>; // uniqueProgramName against user programs
  export async function importProgram(file: ProgramFile, now?: number): Promise<Program>;
  ```

- [ ] **Step 1: Failing tests** (`fake-indexeddb/auto`, `ensureSeed()` in `beforeEach`, same `wipe` pattern as backup tests):
  - With one session + sets + an existing user program + active program set: import → one more program; session/set counts, settings `activeProgramId` and the other program are unchanged.
  - New program and day ids are fresh (not equal to anything in the file and unique).
  - Importing the same file twice → names `PPL` and `PPL (2)`.
  - **Duplicate ids**: a day with `lying-leg-curl` twice → both kept, in order.
  - A custom exercise id that exists → imports; after `deleteCustomExercise` (hard) → `importProgram` rejects with `ProgramImportError` whose `errors` mention that id, and the program count is unchanged.
  - A cardio id (`running`) → `ProgramImportError`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** inside one `db.transaction('rw', [db.programs, db.exercises, db.exerciseMuscles, db.customExercises, db.customExerciseMuscles], …)`: compute known ids, `findUnknownExercises` → throw if any, `uniqueProgramName` against `db.programs` names, `toProgram` with `newId()` ids, `db.programs.add`.
- [ ] **Step 4: Run `npm run check`** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(programs): import a program file without replacing data`

### Task 7: The coach plan example file

**Files:**

- Create: `examples/programs/ppl-alternating.json`, `src/program/examplePrograms.test.ts`

**Interfaces:**

- Consumes: `parseProgramFile`, `findUnknownExercises` (Task 5); catalog from `@/data` (Task 1).

- [ ] **Step 1: Write `examplePrograms.test.ts`**: read the file with `fs.readFileSync(new URL('../../examples/programs/ppl-alternating.json', import.meta.url), 'utf8')`; assert `ok: true`; `findUnknownExercises(file, new Set(exercises.filter(e => e.tracking !== 'cardio').map(e => e.id)))` equals `[]` (use the same cardio check `isCardio` uses); day names equal `['Legs #1','Push #1','Pull #1','Legs #2','Push #2','Pull #2']`; total exercises `34`; Legs #1 exercise 4 has `exerciseId: 'lying-leg-curl'`, `sets: 1`, `reps {20,20}`, note `'PITT Force – 20 single reps, pause 3–4 s each'`; Pull #2 exercise 1 (`pull-up`) has no `reps`.
- [ ] **Step 2: Run** — Expected: FAIL (file missing).
- [ ] **Step 3: Write the JSON** exactly from spec §5 (name "PPL alternating"; "—" rows have no `note`; "—" reps have no `reps`; single numbers `n` → `{ min: n, max: n }`; "15 → 12"-style ranges → `{ min: 12, max: 15 }`).
- [ ] **Step 4: Run `npm run check`** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(examples): coach PPL alternating program file`

### Task 8: Import UI

**Files:**

- Create: `src/components/program/ImportProgramButton.tsx`
- Modify: `src/pages/ProgramsPage.tsx` (next to `data-testid="new-program"`)

**Interfaces:**

- Consumes: `parseProgramFile`, `knownProgramExerciseIds`, `previewImportName`, `importProgram`, `ProgramImportError`.
- Produces: test ids `import-program` (button), `import-program-file` (input), `import-program-errors` (error dialog list), `import-program-preview` (confirm dialog), `import-program-confirm` (Import button).

- [ ] **Step 1: Implement** the component: hidden file input (`accept="application/json,.json"`), reset `input.value = ''` after each read; `file.text()` → parse → unknown-id check → either the error dialog (title "Can't import this program", first 20 errors, then "…and N more") or the preview dialog (resolved name from `previewImportName`, "N days · M exercises", one line per day "Legs #1 — 5 exercises", buttons Import / Cancel). On Import: `importProgram` → `navigate('/programs/' + id, { state: { status: 'Imported. Set it as active to start using it.' } })`; `ProgramImportError` → error dialog with its `errors`; other errors → `console.error` + error dialog with "Import failed. Your programs were not changed."
- [ ] **Step 2: Show the status** on the program detail route in `ProgramsPage.tsx` from `location.state.status` in a `role="status"` paragraph.
- [ ] **Step 3: Run `npm run check`** — Expected: PASS. (Behaviour is covered by Task 10 e2e.)
- [ ] **Step 4: Commit** — `feat(programs): Import program button`

### Task 9: Note UI

**Files:**

- Create: `src/components/program/ExerciseNote.tsx` (read-only display: muted `text-sm`, wraps, `data-testid="exercise-note"`; renders nothing for empty)
- Modify: `src/components/program/ProgramEditor.tsx` (row ~285–340), `src/components/SessionEditor.tsx` (just before `<TargetChip` ~line 130)

**Interfaces:**

- Consumes: `edit.setNote`, `NOTE_MAX` (Task 2); `SessionExercise.note` (Task 3).

- [ ] **Step 1: ProgramEditor** — show `<ExerciseNote>` under each row (read-only mode too). In edit mode add a text button "Add note" / "Edit note" (`data-testid="edit-note"`) toggling an `Input` (`maxLength={NOTE_MAX}`, `aria-label={`Note for ${name}`}`, `data-testid="note-input"`) that saves on blur or Enter via `update((p) => edit.setNote(p, day.id, i, value))`; Escape cancels.
- [ ] **Step 2: SessionEditor** — render `<ExerciseNote note={se.note} />` for non-cardio cards above `TargetChip`. HistoryPage reuses `SessionEditor`, so history shows it too.
- [ ] **Step 3: Run `npm run check`** — Expected: PASS.
- [ ] **Step 4: Commit** — `feat(ui): show and edit exercise notes`

### Task 10: End-to-end

**Files:**

- Create: `e2e/program-import.spec.ts` (use `./fixtures` like `programs.spec.ts`)

- [ ] **Step 1: Write the specs**
  - Import `examples/programs/ppl-alternating.json` via `page.getByTestId('import-program-file').setInputFiles(...)` → preview shows "6 days · 34 exercises" → click Import → URL matches `/programs/` and status text "Imported. Set it as active to start using it." is visible → 6 day headings.
  - Set it active, start "Legs #1" → the Lying Leg Curl card's `exercise-note` reads "PITT Force – 20 single reps, pause 3–4 s each".
  - Edit a note in the editor → reload → the new note persists.
  - Broken file (unknown id `leg-curl`) → `import-program-errors` contains `unknown exercise "leg-curl"`; the "My programs" list count is unchanged. **Then pick the same broken file again** → the error dialog shows again (input reset works).
- [ ] **Step 2: Run `npx playwright test e2e/program-import.spec.ts`** — Expected: PASS. Then `npm run e2e` — Expected: whole suite PASS.
- [ ] **Step 3: Commit** — `test(e2e): program import and notes`
