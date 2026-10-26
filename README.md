# Lift Log

An offline-first exercise log PWA. Log workouts (exercises, sets, weight, reps, RIR, warm-ups), browse
history, see weekly volume per muscle on a body map, and get rule-based progression targets, volume
suggestions and exercise swaps. Everything stays on-device in IndexedDB. No account, no server; installable and fully
usable offline via a service worker.

## Requirements

- Node 20 (see `.nvmrc`).
- Install with `npx -y npm@11 i`. npm 10 crashes on vite 8.

## Scripts

| Command                                                | What it does                                               |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `npm run dev`                                          | Vite dev server                                            |
| `npm run build`                                        | Typecheck + production build (with service worker)         |
| `npm run preview`                                      | Serve the production build                                 |
| `npm run check`                                        | Typecheck, lint, unit tests (vitest)                       |
| `npm run e2e`                                          | Playwright (always builds fresh, previews on :4174, 375px) |
| `node scripts/build-seed.mjs`                          | Regenerate seed JSON from `data/curation.json`             |
| `node scripts/fetch-images.mjs`, `optimize-images.mjs` | Fetch and optimize exercise images (see `data/README.md`)  |

## Layout

- `data/` curated exercise config, raw source dump, curation notes (see `data/README.md`).
- `scripts/` seed builder and icon generation.
- `src/data/` generated seed (exercises, muscles, exercise-muscle weights) and zod schema.
- `src/db/` Dexie database and the repository layer (`sessionsRepo`, `setsRepo`, `exercisesRepo`,
  `settingsRepo`, backup, seeding, hooks). UI talks to the DB only through these.
- `src/analyzer/` pure weekly-volume, status and exercise-stats functions (+ `fixtures.ts` generator).
- `src/recommend/` pure progression, volume-suggestion and alternative-exercise functions.
- `src/config/training.ts` every training threshold (the only place to tune them).
- `src/db/analysisRepo.ts` loads a snapshot from Dexie and calls the engines; hooks wrap it.
- `src/pages/`, `src/components/` UI (`analyze/` body map + dashboard, `recommend/` chips, swap,
  suggestions); `src/lib/` units and pure helpers.
- `e2e/` Playwright specs.

## Exercise images

Each exercise has start/end how-to photos in `public/exercises/<id>/` (public domain, from
free-exercise-db). They are precached by the service worker (~5 MB) so they work offline. Tap an
exercise in the Exercises tab, or the info button on a workout card, to view them.

## Data model and units

Tables: `exercises`, `muscles`, `exerciseMuscles`, `sessions`, `sessionExercises`, `sets`, `settings`.
All weights are stored in **kg**; lbs exist only at the UI edge (display and input conversion,
rounded to 1 lb). For bodyweight exercises the stored weight is added load.

## Backup

Settings offers JSON export and import of user data (sessions, exercises, sets, settings) so data
can move between devices or survive a cleared browser. Backup format v2 adds the week start, target
overrides and equipment settings; v1 (phase-1) files still import and leave those settings as they are.

The Dexie schema is still version 1: phase-2 settings are rows in the existing key-value `settings`
table, so no migration was needed. The seed data did not change, so `SEED_VERSION` stays 2.

## Seed versioning

The bundled exercise library carries `SEED_VERSION` (`src/data/index.ts`). On startup the app compares
it with the stored seed version and re-seeds only seed-owned tables (exercises, muscles,
exerciseMuscles). Re-seeding never touches user data (sessions, sets, settings, custom exercises).
Bump `SEED_VERSION` whenever the generated output changes.

## How the analyzer counts sets

- **Counted set:** completed (`completedAt` set), not a warm-up, reps > 0, and either no RIR recorded
  or RIR <= `maxCountedRir` (4). Easier sets are not "hard sets" and are left out.
- **Weekly volume per muscle** = sum of that exercise's muscle weight over counted sets
  (`exerciseMuscles`: primary 1.0, secondary 0.5, curated 0.25-1.0). Example: 4 sets of bench press =
  chest 4, front delts 2, triceps 2.
- **Week:** calendar week in the device's local timezone; start day is a setting (default Monday).
  A session's sets belong to the week of the session's `startedAt`, even if it runs past midnight.
- **Status** vs the muscle's targets: `none` (0), `below` (< MEV), `building` (MEV to < MAV low),
  `optimal` (MAV low-high), `high` (> MAV high to MRV), `over` (> MRV).
- **Progression** (double progression): all working sets at the top of the rep range at RIR <= 3 ->
  add weight (+5 kg lower-body barbell, +2.5 kg upper barbell/machine, +1 kg dumbbell; 10/5/2.5 lb);
  bottom missed 2 sessions in a row -> hold, 3 -> about -10%; otherwise same weight, +1 rep. The
  session being logged never counts as "last time".
- **Alternatives:** 0.6 x cosine similarity of muscle-weight vectors + 0.2 same force + 0.1 same
  mechanic + 0.1 equipment available - 0.15 if already done this week; exercises needing equipment
  you don't have (Settings > My equipment) are excluded.

## Tuning thresholds

All numbers live in `src/config/training.ts`: default MEV/MAV/MRV per muscle (starting heuristics in
the spirit of RP volume landmarks and the 10-20 sets/week research consensus), `maxCountedRir`, rep
ranges and per-exercise overrides, target RIR, load steps (kg and lbs), hold/deload rules, alternative
scoring weights and the stale-session limit (12 h). Users can override per-muscle targets and the week
start in Settings. Suggestions are general training heuristics, not medical advice.

Performance: `src/analyzer/analyzer.test.ts` runs a year of generated data (52 weeks x 5 sessions)
through the analyzer and asserts it finishes in under 200 ms.
