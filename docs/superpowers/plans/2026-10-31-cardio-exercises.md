# Cardio Exercises Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Running, Cycling (outdoor), Swimming (Freestyle) and Swimming (Breaststroke) as
duration + intensity exercises that show an estimated distance and credit weekly muscle volume.

**Architecture:** Exercises gain `tracking` / `cardioProfile`. Cardio rows live in a new Dexie
`cardioEntries` table (schema v3) under the existing `sessionExercises` rows. A pure engine
(`src/analyzer/cardio.ts`) turns entries into distance and capped set credit; `bucketSets` adds that
credit next to counted strength sets, so everything downstream of the bucket is unchanged.

**Tech Stack:** React 19.3 + TypeScript, Dexie 4.4 (IndexedDB), zod 4.6, vitest 5 +
fake-indexeddb, Playwright 1.64 (375 px), Node 20 seed scripts.

**Spec:** `docs/superpowers/specs/2026-10-31-cardio-exercises-design.md`

## Global Constraints

- Install with `npx -y npm@11 i`; Node 20 (`export PATH=$HOME/.nvm/versions/node/v20.20.2/bin:$PATH`).
- Every threshold lives in `src/config/training.ts` (`TRAINING.cardio`); no magic numbers elsewhere.
- UI talks to the DB only through repos/hooks in `src/db/`; engines in `src/analyzer/` stay pure.
- Weights stay in kg; cardio durations are stored as `durationSec` (whole minutes × 60).
- Paces (km/h): running 8.5714 / 10 / 12; cycling 16 / 20 / 25; swim-freestyle 2.0 / 2.4 / 3.0;
  swim-breaststroke 1.7143 / 2.0 / 2.4 (relaxed / moderate / hard). The 4-decimal values are
  60/7 and 6/3.5 so relaxed paces display as exactly 7:00 /km and 3:30 /100 m.
- Credit: `minutesPerSet: 10`, `intensityMultiplier { relaxed: 1, moderate: 1.5, hard: 2 }`,
  `maxSetsPerSession: 3`, per session exercise.
- Minutes input range 1–600, clamped on commit.
- Dexie schema v2 → v3 only adds `cardioEntries: 'id, sessionExerciseId, [sessionExerciseId+order]'`.
- `SEED_VERSION` 4 → 5; `BACKUP_VERSION` 5 → 6.
- `npm run check` (typecheck, lint, vitest) passes at the end of every task.

### Spec corrections found while planning (apply these, they override the spec)

1. **Import of v1–v5 clears `cardioEntries`.** `importData` replaces all sessions, so leaving cardio
   rows would orphan them. Import always clears `cardioEntries` and adds the file's (`[]` when absent).
2. **Seed count limit.** `build-seed.mjs` fails outside 60–80 exercises; there are already 80. Raise
   the upper bound to 90.
3. **Seed entries without a source.** The swims have no free-exercise-db entry: curation entries may
   omit `src` when they have `cardio`; their `source` is `"manual"` and `images` is `[]`.
   `fetch-images.mjs` skips entries without `src`.
4. **Cardio never appears as a strength recommendation.** `alternatives()` and
   `volumeSuggestions()` skip cardio candidates (swapping a squat for a run is not a swap), and
   `analyzer/fixtures.ts` builds its random pool from strength exercises only.
5. **Old custom exercise rows have no `tracking`.** Treat a missing `tracking` as `'strength'` via
   one helper, `isCardio()`, everywhere.

## Review Focus

- **Editing minutes on an already-ticked entry down to empty/0** → the entry un-ticks and stops
  counting (pinned in Task 3).
- **Swapping a session exercise between strength and cardio** → swap is hidden for cardio cards, and
  the swap dialog never offers cardio for a strength card (pinned in Tasks 5 and 7).
- **Restoring a v5 backup over a profile that already logged cardio** → no orphaned cardio rows; the
  analyzer, summary and history show no cardio (pinned in Task 4).
- **A session holding only cardio** (no sets) → History shows it with "Running 30 min · ≈ 4.3 km",
  `workingSets` 0, no volume tile change, stale prompt ends at the last ticked entry (pinned in Task 6).
- **Removing a cardio exercise card** → confirm prompt appears when it has entries; entries are
  deleted with it (pinned in Tasks 3 and 7).

---

### Task 1: Cardio config, types and pure engine

**Files:**

- Modify: `src/config/training.ts` (add `cardio` block)
- Modify: `src/data/schema.ts` (export `TRACKING`, `CARDIO_PROFILES`; types only in this task)
- Modify: `src/db/types.ts` (add `CardioIntensity`, `CardioEntry`)
- Create: `src/analyzer/cardio.ts`, `src/analyzer/cardio.test.ts`
- Modify: `src/analyzer/index.ts` (re-export)

**Interfaces:**

- Produces:
  - `src/data/schema.ts`: `TRACKING = ['strength', 'cardio'] as const`;
    `CARDIO_PROFILES = ['running', 'cycling', 'swim-freestyle', 'swim-breaststroke'] as const`;
    `type CardioProfile = (typeof CARDIO_PROFILES)[number]`.
  - `src/db/types.ts`: `CARDIO_INTENSITIES = ['relaxed', 'moderate', 'hard'] as const`;
    `type CardioIntensity`; `interface CardioEntry { id; sessionExerciseId; order; durationSec: number; intensity: CardioIntensity; completedAt?: number }`.
  - `TRAINING.cardio: { profiles: Record<CardioProfile, Record<CardioIntensity, number>>; minutesPerSet: number; intensityMultiplier: Record<CardioIntensity, number>; maxSetsPerSession: number; maxMinutes: 600 }`.
  - `src/analyzer/cardio.ts`:
    - `isCardio(e: { tracking?: string } | undefined): boolean`
    - `speedKmh(profile: CardioProfile, intensity: CardioIntensity): number`
    - `estimateDistanceKm(profile: CardioProfile | undefined, intensity: CardioIntensity, durationSec: number): number | undefined` (undefined for unknown/missing profile)
    - `formatEstimate(profile: CardioProfile | undefined, intensity: CardioIntensity, durationSec: number): string | undefined` → `"≈ 4.3 km · 7:00 /km"`, `"≈ 8.0 km · 16 km/h"`, `"≈ 1,000 m · 3:00 /100 m"`; undefined when profile unknown or `durationSec <= 0`
    - `isCountedEntry(e: CardioEntry): boolean` (completed and `durationSec > 0`)
    - `cardioSetCredit(entries: CardioEntry[], config = TRAINING.cardio): number`
    - `countedMinutes(entries: CardioEntry[]): number`

- [ ] **Step 1: Write the failing tests** in `src/analyzer/cardio.test.ts`

```ts
const entry = (min: number, intensity: CardioIntensity = 'relaxed', done = true): CardioEntry => ({
  id: `e${min}${intensity}`,
  sessionExerciseId: 'se',
  order: 0,
  durationSec: min * 60,
  intensity,
  completedAt: done ? 1 : undefined,
});

it('estimates distance for every profile', () => {
  expect(estimateDistanceKm('running', 'relaxed', 1800)).toBeCloseTo(4.285, 2);
  expect(estimateDistanceKm('cycling', 'relaxed', 1800)).toBeCloseTo(8, 5);
  expect(estimateDistanceKm('swim-freestyle', 'relaxed', 1800)).toBeCloseTo(1, 5);
  expect(estimateDistanceKm('swim-breaststroke', 'hard', 3600)).toBeCloseTo(2.4, 5);
  expect(estimateDistanceKm(undefined, 'relaxed', 1800)).toBeUndefined();
});
it('formats pace per profile and rounds to the table', () => {
  expect(formatEstimate('running', 'relaxed', 1800)).toBe('≈ 4.3 km · 7:00 /km');
  expect(formatEstimate('running', 'hard', 1800)).toBe('≈ 6.0 km · 5:00 /km');
  expect(formatEstimate('cycling', 'relaxed', 1800)).toBe('≈ 8.0 km · 16 km/h');
  expect(formatEstimate('swim-freestyle', 'relaxed', 1800)).toBe('≈ 1,000 m · 3:00 /100 m');
  expect(formatEstimate('swim-breaststroke', 'relaxed', 1800)).toBe('≈ 855 m · 3:30 /100 m');
  expect(formatEstimate('running', 'relaxed', 0)).toBeUndefined();
});
it('credits 10 relaxed minutes as one set with intensity multipliers', () => {
  expect(cardioSetCredit([entry(10)])).toBe(1);
  expect(cardioSetCredit([entry(10, 'moderate')])).toBe(1.5);
  expect(cardioSetCredit([entry(10, 'hard')])).toBe(2);
  expect(cardioSetCredit([entry(10), entry(5, 'hard')])).toBe(2);
});
it('caps credit at 3 per session exercise', () => {
  expect(cardioSetCredit([entry(120)])).toBe(3);
  expect(cardioSetCredit([entry(20), entry(20)])).toBe(3);
});
it('ignores uncompleted and 0-minute entries', () => {
  expect(cardioSetCredit([entry(30, 'relaxed', false), entry(0)])).toBe(0);
  expect(countedMinutes([entry(30), entry(15, 'hard', false)])).toBe(30);
});
it('treats missing tracking as strength', () => {
  expect(isCardio({})).toBe(false);
  expect(isCardio({ tracking: 'cardio' })).toBe(true);
});
```

- [ ] **Step 2: Run** `npx vitest run src/analyzer/cardio.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement** the config block, the two type additions and `cardio.ts`. Paces: running
      and swims format `m:ss` from `60 / speed` (per km) or `6 / speed` (per 100 m), rounded to whole
      seconds; cycling shows `Math.round(speed)` km/h. Distance: km with one decimal for running/cycling,
      whole metres rounded to 5 with `toLocaleString('en-US')` for swims.

- [ ] **Step 4: Run** `npx vitest run src/analyzer/cardio.test.ts` — Expected: PASS. Then `npm run check`.

- [ ] **Step 5: Commit** `feat(cardio): add cardio pace config and pure estimate/credit engine`

---

### Task 2: Seed — four cardio exercises

**Files:**

- Modify: `src/data/schema.ts` (`ExerciseSchema` fields, `validateSeed` rules)
- Modify: `scripts/build-seed.mjs`, `scripts/fetch-images.mjs`
- Modify: `data/curation.json`, `data/CURATION.md`, `data/README.md` (image rule line)
- Generated: `src/data/exercises.json`, `src/data/exerciseMuscles.json`, `public/exercises/running/*`, `public/exercises/cycling-outdoor/*`
- Modify: `src/data/index.ts` (`SEED_VERSION = 5`)
- Modify: `src/db/customExercisesRepo.ts` (new custom rows get `tracking: 'strength'`), `src/db/backup.ts` (`CustomExerciseSchema.tracking: z.literal('strength').optional()`)
- Test: `src/data/seed.test.ts`

**Interfaces:**

- Consumes: `TRACKING`, `CARDIO_PROFILES` (Task 1).
- Produces: `Exercise.tracking: 'strength' | 'cardio'` (zod `.default('strength')`),
  `Exercise.cardioProfile?: CardioProfile`. Seed ids: `running`, `cycling-outdoor`,
  `swimming-freestyle`, `swimming-breaststroke`.

- [ ] **Step 1: Write the failing tests** in `src/data/seed.test.ts`

```ts
it('ships the four cardio exercises with profiles', () => {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  expect(byId.get('running')).toMatchObject({ tracking: 'cardio', cardioProfile: 'running' });
  expect(byId.get('cycling-outdoor')).toMatchObject({ cardioProfile: 'cycling' });
  expect(byId.get('swimming-freestyle')).toMatchObject({
    cardioProfile: 'swim-freestyle',
    images: [],
  });
  expect(byId.get('swimming-breaststroke')).toMatchObject({
    cardioProfile: 'swim-breaststroke',
    images: [],
  });
  expect(byId.get('barbell-back-squat')?.tracking).toBe('strength');
});
it('maps cardio muscles as reviewed', () => {
  const w = (id: string) =>
    Object.fromEntries(
      exerciseMuscles.filter((l) => l.exerciseId === id).map((l) => [l.muscleId, l.weight]),
    );
  expect(w('running')).toEqual({ quads: 1, glutes: 0.5, hamstrings: 0.5, calves: 0.5 });
  expect(w('cycling-outdoor')).toEqual({ quads: 1, glutes: 0.5, hamstrings: 0.25, calves: 0.25 });
  expect(w('swimming-freestyle')).toEqual({
    lats: 1,
    front_delts: 0.5,
    upper_back: 0.5,
    triceps: 0.25,
    abs: 0.25,
  });
  expect(w('swimming-breaststroke')).toEqual({
    chest: 1,
    quads: 0.5,
    adductors: 0.5,
    lats: 0.5,
    glutes: 0.25,
  });
});
it('allows 0 images for cardio but not strength', () => {
  /* validateSeed with a cloned seed: cardio images [] passes; a strength exercise with 1 image throws /need >= 2/ */
});
it('requires cardioProfile exactly when tracking is cardio', () => {
  /* cardio w/o profile throws /cardioProfile/; strength with profile throws /cardioProfile/ */
});
```

- [ ] **Step 2: Run** `npx vitest run src/data/seed.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement schema + validation.** In `ExerciseSchema`: `tracking: z.enum(TRACKING).default('strength')`, `cardioProfile: z.enum(CARDIO_PROFILES).optional()`. In `validateSeed`, `minImages` is `0` for cardio; add the two `cardioProfile` problems.

- [ ] **Step 4: Update the builder.** In `build-seed.mjs`: curation key `cardio: "<profile>"` sets `tracking: 'cardio'` and `cardioProfile`; all other entries get `tracking: 'strength'`. An entry without `src` is allowed only with `cardio` and must set `eq`, `force`, `mech`, `level`, `m`; it gets `source: 'manual'`, `images: []`, and is skipped by the image-count and `seenSrc` checks. Raise the count bound to 90. In `fetch-images.mjs`, `continue` when `c.src` is absent.

- [ ] **Step 5: Add curation entries** (aliases sorted by builder):
  - `{ "src": "Trail_Running_Walking", "id": "running", "name": "Running", "eq": "bodyweight", "force": "legs", "mech": "compound", "level": "beginner", "cardio": "running", "al": ["run", "jog", "jogging"], "m": "quads,glutes:.5,hamstrings:.5,calves:.5" }`
  - `{ "src": "Bicycling", "id": "cycling-outdoor", "name": "Cycling (outdoor)", "eq": "other", "force": "legs", "mech": "compound", "level": "beginner", "bw": true, "cardio": "cycling", "al": ["bike", "cycle", "cycling"], "m": "quads,glutes:.5,hamstrings:.25,calves:.25" }`
  - `{ "id": "swimming-freestyle", "name": "Swimming (Freestyle)", "eq": "bodyweight", "force": "pull", "mech": "compound", "level": "beginner", "cardio": "swim-freestyle", "al": ["swim", "front crawl", "freestyle"], "m": "lats,front_delts:.5,upper_back:.5,triceps:.25,abs:.25" }`
  - `{ "id": "swimming-breaststroke", "name": "Swimming (Breaststroke)", "eq": "bodyweight", "force": "pull", "mech": "compound", "level": "beginner", "cardio": "swim-breaststroke", "al": ["swim", "breaststroke"], "m": "chest,quads:.5,adductors:.5,lats:.5,glutes:.25" }`

  Add a `CURATION.md` paragraph explaining the weights (running/cycling are quad-dominant; freestyle pull is lats-led; breaststroke press + whip kick → chest, adductors).

- [ ] **Step 6: Regenerate**: `node scripts/fetch-images.mjs && node scripts/optimize-images.mjs && node scripts/build-seed.mjs` — Expected: `exercises: 84`, no FAILED line. Set `SEED_VERSION = 5`. Add `tracking: 'strength'` to `createCustomExercise`'s row; add the optional literal to `CustomExerciseSchema`.

- [ ] **Step 7: Run** `npm run check` — Expected: PASS (seed + existing DB seed tests).

- [ ] **Step 8: Commit** `feat(cardio): seed running, cycling and two swim strokes`

---

### Task 3: Dexie v3, cardio repo and session detail

**Files:**

- Modify: `src/db/db.ts` (version 3, `cardioEntries` table)
- Create: `src/db/cardioRepo.ts`, `src/db/cardioHooks.ts`, `src/db/cardio.test.ts`
- Modify: `src/db/sessionsRepo.ts` (`SessionExerciseDetail.cardio`, cascades), `src/db/index.ts`, `src/db/hooks.ts` (re-export)
- Test: extend `src/db/phase3.test.ts` pattern for v2 → v3

**Interfaces:**

- Consumes: `CardioEntry`, `CardioIntensity` (Task 1); `TRAINING.cardio.maxMinutes`.
- Produces:
  - `db.cardioEntries: EntityTable<CardioEntry, 'id'>`
  - `SessionExerciseDetail.cardio: CardioEntry[]` (ordered; `[]` for strength)
  - `cardioRepo`: `listEntries(sessionExerciseId): Promise<CardioEntry[]>`, `addEntry(sessionExerciseId): Promise<CardioEntry>`, `updateEntry(id, patch: Partial<Pick<CardioEntry, 'durationSec' | 'intensity'>>): Promise<void>`, `setEntryDone(id, done: boolean, patch?): Promise<void>`, `deleteEntry(id): Promise<void>`, `getCardioHistory(exerciseId, limit = 10): Promise<CardioHistoryItem[]>` where `CardioHistoryItem = { sessionId: string; startedAt: number; minutes: number; intensity: CardioIntensity; distanceKm?: number }` (one per session, the longest counted entry's intensity)
  - `clampMinutes(n: number): number` (1–600, rounded) exported from `cardioRepo`
  - `useCardioHistory(exerciseId?: string)` in `cardioHooks.ts`

- [ ] **Step 1: Write failing tests** in `src/db/cardio.test.ts`:
  - `addEntry` on an empty card → `{ durationSec: 0, intensity: 'relaxed', order: 0 }`; second add copies the first entry's minutes/intensity; first add in a new session copies the most recent earlier session's last entry.
  - `setEntryDone(id, true)` with `durationSec: 0` leaves `completedAt` undefined; with 1800 sets it.
  - **Review focus:** `updateEntry(id, { durationSec: 0 })` on a ticked entry clears `completedAt`.
  - `clampMinutes(0) === 1`, `clampMinutes(900) === 600`, `clampMinutes(29.6) === 30`.
  - **Review focus:** `removeExercise(seId)` and `deleteSession(id)` delete that card's `cardioEntries` (count 0 after).
  - `getSessionDetail` returns `cardio` ordered by `order` and `sets: []` for a cardio card.
  - `getCardioHistory('running')` → newest first, `minutes: 30`, `distanceKm ≈ 4.285`.
  - Upgrade: open a v2 DB with sessions/sets (copy the `phase3.test.ts` approach), reopen with `LiftLogDB` → data intact and `cardioEntries` exists and is empty.
  - Profiles: after `bindDb('lift-log-p2')`, `addEntry` writes to that profile's DB only (follow `profiles.test.ts`).

- [ ] **Step 2: Run** `npx vitest run src/db/cardio.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** v3 store (`cardioEntries: 'id, sessionExerciseId, [sessionExerciseId+order]'`), the repo mirroring `setsRepo` (ordering, renumber on delete, prefill from previous session), and add `db.cardioEntries` to the `removeExercise` / `deleteSession` transactions and to `getSessionDetail`.

- [ ] **Step 4: Run** `npx vitest run src/db` then `npm run check` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(cardio): add cardioEntries table, repo and session detail`

---

### Task 4: Backup v6

**Files:**

- Modify: `src/db/backup.ts`
- Create: `src/db/__fixtures__/phase6-export.json`, `src/db/backupV6.test.ts`

**Interfaces:**

- Consumes: `db.cardioEntries`, `CardioEntry` (Task 3).
- Produces: `BACKUP_VERSION = 6`; `Backup.cardioEntries?: CardioEntry[]`; `CardioEntrySchema` (zod: `durationSec` int ≥ 0, `intensity` enum).

- [ ] **Step 1: Write failing tests** in `backupV6.test.ts`:
  - export after logging a 30 min run → `version: 6`, `cardioEntries.length === 1`; import into a reset DB → entry identical.
  - phase6 fixture parses and imports.
  - `parseBackup` rejects a cardio entry whose `sessionExerciseId` is unknown (`/cardio entry references unknown exercise entry/`) and duplicate cardio ids (`/duplicate ids/`).
  - **Review focus:** log a run, then import `phase5-export.json` → `db.cardioEntries.count() === 0`.
  - phase1–phase5 fixtures still import (existing tests keep passing).

- [ ] **Step 2: Run** `npx vitest run src/db/backupV6.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**: add `z.literal(5)` to the version union before `BACKUP_VERSION`; `cardioEntries: z.array(CardioEntrySchema).optional()`; export it; add `db.cardioEntries` to `USER_TABLES`; in `importData` clear it with the other three tables and `bulkAdd(valid.cardioEntries ?? [])`; referential + duplicate checks in `parseBackup`. Build the fixture by exporting from a test DB with one strength set and one ticked 30 min relaxed run.

- [ ] **Step 4: Run** `npm run check` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(cardio): backup format v6 with cardio entries`

---

### Task 5: Analyzer and recommendation integration

**Files:**

- Modify: `src/analyzer/types.ts` (`TrainingData.cardioEntries`, `MuscleContribution.minutes?`), `src/analyzer/volume.ts` (`bucketSets`, `buildWeek`), `src/analyzer/fixtures.ts` (strength-only pool, `cardioEntries: []`)
- Modify: `src/db/analysisRepo.ts` (`loadTrainingData` reads `db.cardioEntries`)
- Modify: `src/recommend/alternatives.ts`, `src/recommend/volume.ts` (skip `isCardio` candidates)
- Test: `src/analyzer/analyzer.test.ts`, `src/recommend/recommend.test.ts`

**Interfaces:**

- Consumes: `cardioSetCredit`, `countedMinutes`, `isCardio` (Task 1).
- Produces: buckets now hold `{ sets: number; minutes: number }` per exercise internally; `MuscleContribution.minutes?: number` set only for cardio; `TrainingData.cardioEntries: CardioEntry[]` (required; every caller/fixture passes `[]` at least).

- [ ] **Step 1: Write failing tests** in `analyzer.test.ts` (build `TrainingData` by hand like the existing tests):
  - one session this week with a ticked 30 min relaxed `running` entry → `current.muscles.quads.sets === 3`, `glutes/hamstrings/calves === 1.5`; contribution `{ exerciseId: 'running', sets: 3, weightedSets: 3, minutes: 30 }`; `exercisesDone` contains `running`.
  - 120 min relaxed → quads 3 (cap).
  - same week also has 3 counted squat sets (quads 1.0) → quads 6.
  - entry in the previous week shows in `trend.quads[trend.quads.length - 2].sets === 3`.
  - unticked entry → quads 0 and `running` not in `exercisesDone`.
  - a cardio exercise with no `cardioProfile` (hand-built corrupt data) → credit 0, no throw.
  - In `recommend.test.ts`: **Review focus:** `alternatives({ exerciseId: 'barbell-back-squat', ... })` contains no cardio ids; `volumeSuggestions` for low quads lists no cardio ids.

- [ ] **Step 2: Run** `npx vitest run src/analyzer src/recommend` — Expected: FAIL.

- [ ] **Step 3: Implement.** In `bucketSets`, group counted cardio entries by `sessionExerciseId` (skipping exercises without a `cardioProfile`), compute `cardioSetCredit` per group and add it (plus `countedMinutes`) to the exercise's bucket in the session's window. `buildWeek` copies `minutes` onto the contribution when > 0. `exerciseStats`, progression, deload and plan-vs-actual stay untouched (they read `sets` only).

- [ ] **Step 4: Run** `npm run check` (includes `perf.test.ts`) — Expected: PASS.

- [ ] **Step 5: Commit** `feat(cardio): credit cardio minutes as weekly muscle volume`

---

### Task 6: Session summary, history and stale prompt

**Files:**

- Modify: `src/db/types.ts` (`SessionSummary.cardioMinutes`), `src/db/sessionsRepo.ts` (`HistoryItem.cardioLines`, `summarize`, `listHistory`)
- Modify: `src/components/SummaryStats.tsx`, `src/pages/HistoryPage.tsx`, `src/components/StaleSessionPrompt.tsx`
- Test: `src/db/repos.test.ts`

**Interfaces:**

- Consumes: `SessionExerciseDetail.cardio` (Task 3), `formatEstimate`, `countedMinutes` (Task 1).
- Produces: `SessionSummary.cardioMinutes: number`; `HistoryItem.cardioLines: string[]` like `"Running 30 min · ≈ 4.3 km"` (distance part from the longest counted entry's intensity, summed across entries; omitted when profile unknown).

- [ ] **Step 1: Write failing tests** in `repos.test.ts`:
  - session with 3 squat sets + 30 min run → `workingSets === 3`, `volumeKg` equals the squat volume only, `cardioMinutes === 30`.
  - **Review focus:** session with only a 30 min run → appears in `listHistory()` with `cardioLines: ['Running 30 min · ≈ 4.3 km']`, `workingSets === 0`; `staleFinishTime(detail)` equals the entry's `completedAt`.

- [ ] **Step 2: Run** `npx vitest run src/db/repos.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**; `SummaryStats` adds a `Cardio` tile (`data-testid="summary-cardio"`, value `"30 min"`) only when `cardioMinutes > 0`; History renders `cardioLines` under the exercise names; `staleFinishTime` also scans `e.cardio`.

- [ ] **Step 4: Run** `npm run check` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(cardio): show cardio minutes and distance in summary and history`

---

### Task 7: Logging UI

**Files:**

- Create: `src/components/CardioEntryItem.tsx`, `src/components/CardioBadge.tsx`
- Modify: `src/components/SessionEditor.tsx`, `src/components/ExercisePicker.tsx`, `src/pages/ExercisesPage.tsx`, `src/components/ExerciseDetailDialog.tsx`
- Test: `e2e/cardio.spec.ts` (first half)

**Interfaces:**

- Consumes: `cardioRepo.*`, `clampMinutes` (Task 3), `formatEstimate`, `isCardio` (Task 1), `useCardioHistory` (Task 3).
- Produces: test ids `cardio-entry`, `cardio-minutes`, `cardio-intensity-<relaxed|moderate|hard>`, `cardio-estimate`, `cardio-done`, `add-entry`, `cardio-badge`, `no-photos`, `cardio-history`.

- [ ] **Step 1: Write the failing e2e** `e2e/cardio.spec.ts` (use `e2e/fixtures.ts`):
  - start workout → add exercise "Running" → card shows `add-entry`, no `add-set`, no `swap-exercise`, no weight/reps header; click `add-entry`; `cardio-intensity-relaxed` is pressed; type `30` in `cardio-minutes`, blur → `cardio-estimate` reads `≈ 4.3 km · 7:00 /km`; pick Hard → `≈ 6.0 km · 5:00 /km`; click `cardio-done` → checked.
  - clear minutes → `cardio-done` unchecked (**review focus**).
  - **Review focus:** remove the Running card → confirm dialog appears (accept) and the card is gone.
  - picker lists Running with `cardio-badge`.
  - open info on Swimming (Freestyle) → `no-photos` visible, `cardio-history` visible, no e1RM chart.

- [ ] **Step 2: Run** `npm run e2e -- cardio.spec.ts` — Expected: FAIL.

- [ ] **Step 3: Implement.**
  - `CardioEntryItem({ entry, profile })`: minutes `Input` (`inputMode="numeric"`, commits `clampMinutes` × 60 on blur/enter, empty → 0), three-button segmented control (`aria-pressed`), estimate line (hidden when `formatEstimate` is undefined), done `Checkbox` (ticking with 0 minutes focuses the input, like `SetRowItem`).
  - `SessionEditor`: when `isCardio(exercise)` render a "Cardio" sub-label instead of the bodyweight note, the `CardioEntryItem` list, and an "Add entry" button; hide `TargetChip`, `ExerciseDeloadHint`, swap button and the set header. Remove-confirm checks `sets.length + cardio.length`.
  - `CardioBadge` (same look as `CustomBadge`) in picker and Exercises page rows.
  - `ExerciseDetailDialog`: empty `images` → `ExercisePlaceholder` with text "No photos for this exercise" (`no-photos`); cardio exercises render a `cardio-history` list (date, minutes, intensity, distance) from `useCardioHistory` instead of `E1rmChart`.

- [ ] **Step 4: Run** `npm run check && npm run e2e -- cardio.spec.ts` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(cardio): log cardio by minutes and intensity`

---

### Task 8: Analyze display, guide and what's new

**Files:**

- Modify: `src/components/analyze/MuscleDetailSheet.tsx`
- Modify: `src/guide/content/02-logging.md`, `04-analyze.md`, `08-backups.md`
- Modify: `src/components/guide/WhatsNewDialog.tsx`, `src/db/settingsRepo.ts` (flag `whatsNewCardioSeen`), `src/db/backup.ts` (set the flag on history import, as for phase 5)
- Test: `src/guide/content.test.ts` (existing placeholder test), `e2e/cardio.spec.ts` (second half)

**Interfaces:**

- Consumes: `MuscleContribution.minutes` (Task 5); `TRAINING.cardio` placeholders.
- Produces: guide placeholders `{{cardio.minutesPerSet}}`, `{{cardio.intensityMultiplier.moderate}}`, `{{cardio.intensityMultiplier.hard}}`, `{{cardio.maxSetsPerSession}}`.

- [ ] **Step 1: Extend the e2e**: after ticking 30 min relaxed Running, open Analyze → quads detail sheet `contributions` contains `Running · 30 min → 3.0 sets`.

- [ ] **Step 2: Run** `npm run e2e -- cardio.spec.ts` — Expected: FAIL.

- [ ] **Step 3: Implement.** Contribution row: when `c.minutes` is set render `{name} · {c.minutes} min → {c.weightedSets.toFixed(1)} sets` instead of the `sets × weight` text. Guide: "Cardio {#logging-cardio}" subsection (minutes, intensity, estimate, relaxed default); "How cardio counts {#analyze-cardio}" using the placeholders above; one line in backups about v6. What's new: replace the phase-5 auto list with `CARDIO_ITEMS` (Running/Cycling/Swimming, "Log minutes, not reps", "Counts toward muscles") keyed on `whatsNewCardioSeen`, marking older flags seen on dismiss as the dialog does now.

- [ ] **Step 4: Run** `npm run check && npm run e2e` (full suite) — Expected: PASS.

- [ ] **Step 5: Commit** `feat(cardio): show cardio credit in Analyze and document it`
