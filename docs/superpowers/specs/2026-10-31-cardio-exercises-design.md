# Cardio exercises (duration-based) — design

Date: 2026-10-31
Status: approved in chat, awaiting written-spec review

## Goal

Add four cardio exercises — **Running**, **Swimming (Freestyle)**, **Swimming (Breaststroke)**,
**Cycling (outdoor)** — that are logged by **duration + intensity** instead of weight × reps. From
the logged minutes and the default pace/speed of an ordinary trainee, the app:

1. shows an **estimated distance** (and the assumed pace) on the entry, session summary and history;
2. credits **muscle volume** (weighted hard sets) so cardio shows up in the Analyze tab and body map.

Intensity defaults to **Relaxed**; Moderate and Hard are optional and change both pace and credit.

### Success criteria

- Logging a 30 min relaxed run takes one number input and one tick.
- The entry shows "≈ 4.3 km · 7:00 /km".
- Analyze for that week shows quads +3.0 sets, glutes/hamstrings/calves +1.5 each.
- Existing strength data, backups (v1–v5) and reps-based features behave exactly as before.

## Decisions (from brainstorming)

| Topic             | Decision                                                                    |
| ----------------- | --------------------------------------------------------------------------- |
| Analyzer output   | Both distance estimate and muscle-volume credit                             |
| Input             | Duration (minutes) + intensity picker, Relaxed pre-selected                 |
| Volume conversion | Linear: 10 relaxed min = 1 set; ×1.5 moderate, ×2 hard; cap 3 per session   |
| Exercises         | Running, Swimming (Breaststroke), Swimming (Freestyle), Cycling (outdoor)   |
| Storage           | Separate `cardioEntries` table (Dexie schema v3), not extra `SetRow` fields |

## Pace / speed defaults

Stored as km/h in `TRAINING.cardio.profiles`; displayed as pace.

| Profile             | Relaxed (default)       | Moderate               | Hard                   | Pace unit |
| ------------------- | ----------------------- | ---------------------- | ---------------------- | --------- |
| `running`           | 8.57 km/h (7:00 /km)    | 10 km/h (6:00 /km)     | 12 km/h (5:00 /km)     | min/km    |
| `cycling`           | 16 km/h                 | 20 km/h                | 25 km/h                | km/h      |
| `swim-freestyle`    | 2.0 km/h (3:00 /100 m)  | 2.4 km/h (2:30 /100 m) | 3.0 km/h (2:00 /100 m) | min/100 m |
| `swim-breaststroke` | 1.71 km/h (3:30 /100 m) | 2.0 km/h (3:00 /100 m) | 2.4 km/h (2:30 /100 m) | min/100 m |

Cycling displays speed (km/h) rather than pace, since that is how cyclists read it. Running displays
min/km, swimming min/100 m. Speeds are stored with enough precision that the displayed pace rounds
to the exact values in the table.

## Section 1 — Data model and seed

### Exercise seed

- `ExerciseSchema` gains `tracking: z.enum(['strength', 'cardio'])` and optional
  `cardioProfile: z.enum(['running', 'cycling', 'swim-freestyle', 'swim-breaststroke'])`.
  `build-seed.mjs` defaults `tracking` to `'strength'`; existing exercises are otherwise unchanged.
- Validation rules added to `validateSeed`:
  - `tracking === 'cardio'` requires `cardioProfile`; `'strength'` forbids it.
  - Image minimum: cardio = 0; strength keeps today's rule (2, or 1 for `force: 'static'`).
  - Primary-muscle (one 1.0) and coverage rules apply unchanged.
- New entries in `data/curation.json`:

| id                      | name                    | equipment    | profile             | images source           | muscles                                                     |
| ----------------------- | ----------------------- | ------------ | ------------------- | ----------------------- | ----------------------------------------------------------- |
| `running`               | Running                 | `bodyweight` | `running`           | `Trail_Running_Walking` | quads 1, glutes .5, hamstrings .5, calves .5                |
| `cycling-outdoor`       | Cycling (outdoor)       | `other`      | `cycling`           | `Bicycling`             | quads 1, glutes .5, hamstrings .25, calves .25              |
| `swimming-freestyle`    | Swimming (Freestyle)    | `bodyweight` | `swim-freestyle`    | none                    | lats 1, front_delts .5, upper_back .5, triceps .25, abs .25 |
| `swimming-breaststroke` | Swimming (Breaststroke) | `bodyweight` | `swim-breaststroke` | none                    | chest 1, quads .5, adductors .5, lats .5, glutes .25        |

All four: `force: 'legs'` (running, cycling) / `'pull'` (swims), `mechanic: 'compound'`,
`isBodyweight: true`, `level: 'beginner'`, with aliases (`run`, `jog`; `bike`, `cycle`;
`swim`, `front crawl`, `freestyle`; `swim`, `breaststroke`).

- Fetch/optimize images for running and cycling via the existing scripts. `ExerciseDetailDialog`
  shows a "No photos for this exercise" placeholder when `images` is empty.
- Bump `SEED_VERSION` 4 → 5. Update `data/CURATION.md` with the muscle-weight reasoning.

### `cardioEntries` table (Dexie schema v3)

```ts
export type CardioIntensity = 'relaxed' | 'moderate' | 'hard';

export interface CardioEntry {
  id: string;
  sessionExerciseId: string; // indexed
  order: number;
  durationSec: number; // 0 = not filled in
  intensity: CardioIntensity; // default 'relaxed'
  completedAt?: number;
}
```

- `db.version(3)` adds `cardioEntries: 'id, sessionExerciseId'` and changes no existing store.
  Existing data is preserved (tested like `phase3.test.ts`).
- A cardio exercise in a session still has a `sessionExercises` row; its children are
  `cardioEntries` instead of `sets`. A session exercise never has both.
- New `src/db/cardioRepo.ts` (UI talks to the DB only through repos): `addEntry` (prefills
  minutes and intensity from this exercise's most recent entry, else 0 min / relaxed), `updateEntry`
  (setting `durationSec` to 0 clears `completedAt`, as `setsRepo` does for reps), `setDone`
  (refuses when `durationSec` is 0), `deleteEntry`, plus hooks in `src/db/cardioHooks.ts`.
- Cascades: deleting a session or a session exercise deletes its `cardioEntries`, in the same
  transaction that deletes `sets`.
- Profile databases: the per-profile DB class picks up v3 automatically; covered by a profiles test.

### Backup v6

- `BACKUP_VERSION` 5 → 6; payload adds `cardioEntries: CardioEntry[]`.
- Import of v1–v5 leaves `cardioEntries` untouched. Fixture `src/db/__fixtures__/phase6-export.json`.
- Encrypted envelope unchanged.

### Config (`src/config/training.ts`)

```ts
cardio: {
  profiles: { running: { relaxed: 8.57, moderate: 10, hard: 12 }, ... }, // km/h
  minutesPerSet: 10,
  intensityMultiplier: { relaxed: 1, moderate: 1.5, hard: 2 },
  maxSetsPerSession: 3,
}
```

## Section 2 — Logging UI, analyzer, display

### Logging (`SessionEditor`)

- For `tracking === 'cardio'` the exercise card renders `CardioEntryItem` rows instead of
  `SetRowItem` rows:
  - **minutes** numeric input (whole minutes; stored as `durationSec = minutes × 60`);
  - **intensity** segmented control Relaxed / Moderate / Hard, Relaxed pre-selected;
  - read-only **estimate**: "≈ 4.3 km · 7:00 /km" (cycling: "≈ 8.0 km · 16 km/h"; swims:
    "≈ 1,000 m · 3:00 /100 m"); hidden while minutes is empty;
  - done checkbox; ticking with no minutes focuses the minutes input.
- Button label "Add entry" instead of "Add set".
- Hidden for cardio: weight, RIR, warm-up toggle, `TargetChip`, swap/alternatives, deload hint.
- Exercise picker and Exercises tab show a "Cardio" badge for cardio exercises.

### Pure engine (`src/analyzer/cardio.ts`)

- `speedKmh(profile, intensity): number`
- `estimateDistanceKm(profile, intensity, durationSec): number` = speed × hours.
- `formatPace(profile, intensity): string` — min/km, km/h or min/100 m per profile.
- `cardioSetCredit(entries: CardioEntry[]): number` — over **one session exercise's completed
  entries**: Σ(minutes / `minutesPerSet` × `intensityMultiplier[intensity]`), then
  `min(total, maxSetsPerSession)`. Uncompleted or 0-minute entries contribute 0.
- The cap is per session exercise. Two Running cards in one session are capped independently
  (deliberate simplification; adding the same exercise twice is rare).

### Analyzer integration

- `TrainingData` gains `cardioEntries: CardioEntry[]`; `analysisRepo` (and fixtures) load it.
- `bucketSets` additionally adds, per session exercise of a cardio exercise, its
  `cardioSetCredit` to that exercise's bucket for the week of the session start. Everything
  downstream (muscle weights, status, trend, contributions, body map, needs-attention) is unchanged.
- `exercisesDone` includes a cardio exercise when it has ≥ 1 completed entry with minutes > 0.
- `MuscleContribution` gains optional `minutes?: number` (sum of counted minutes) so the UI can
  label cardio contributions.
- `exerciseStats`, progression, deload and plan-vs-actual read only `sets`, so cardio never reaches
  them. Their exercise lists skip `tracking === 'cardio'`.

### Display

- Muscle detail sheet: cardio contribution reads "Running · 30 min → 3.0 sets".
- `SessionSummary` gains `cardioMinutes`; `workingSets` and `volumeKg` exclude cardio. Summary
  and history show "Running 30 min · ≈ 4.3 km" per cardio exercise; `SummaryStats` shows a
  cardio-minutes tile only when > 0.
- Progress / exercise detail: cardio exercises show a list of recent sessions (date, minutes,
  intensity, estimated distance) instead of the e1RM chart.

### Out of scope

Cardio in programs/templates, calories, user-editable paces (config only, like other thresholds),
distance input, GPS, cardio custom exercises (custom exercises stay strength-only), and a cardio
filter in the picker.

## Section 3 — Guide, errors, testing

### User Guide

- `02-logging.md`: "Cardio" subsection (minutes, intensity, estimate).
- `04-analyze.md`: how minutes become sets, using placeholders resolved from `TRAINING.cardio`
  (minutes per set, multipliers, cap) so the text cannot drift from config.
- `08-backups.md`: v6 note. What's-new entry for the release.

### Error handling / edge cases

- 0-minute entry cannot be ticked; uncompleted entries count nothing.
- Unknown or missing `cardioProfile` at runtime (should not pass seed validation, but e.g. corrupt
  data): no estimate shown, credit 0, no throw.
- Minutes input accepts 1–600; out-of-range input is clamped on commit.
- A v6 backup imported into an older build is rejected by the existing version check.

### Tests (vitest)

- `cardio.test.ts`: speed/distance/pace for all four profiles and three intensities; multiplier
  math; cap at 3; 0-minute and uncompleted entries ignored.
- Analyzer: 30 min relaxed run → quads 3.0, glutes/hamstrings/calves 1.5; 120 min relaxed run
  capped at 3; mixed strength + cardio week sums; entry in the previous week lands in trend.
- Seed: four new exercises validate; cardio with 0 images passes; strength with < 2 images still
  fails; `cardio` without `cardioProfile` fails.
- DB: v2 → v3 upgrade preserves data; cardio CRUD, prefill, done-guard; cascade deletes from
  session and session-exercise removal; v6 round-trip; v1–v5 fixtures still import.
- Summary: `workingSets`/`volumeKg` unchanged by cardio; `cardioMinutes` correct.
- Guide: placeholders for cardio resolve (existing content tests).

### Tests (Playwright, 375 px)

- Add Running to a workout, enter 30, see "≈ 4.3 km", tick, open Analyze, quads show credit.
- Add Swimming (Freestyle), open its info: "No photos" placeholder renders.
