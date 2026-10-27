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
- `src/program/` pure program types, built-in templates and the weekly plan check.
- `src/guide/` the in-app User Guide: Markdown topics in `src/guide/content/`, a small safe
  renderer, search and the placeholder resolver; screenshots in `public/guide/`.
- `e2e/` Playwright specs (`e2e/fixtures.ts` auto-dismisses first-run overlays for older specs).

## Exercise images

Each exercise has start/end how-to photos in `public/exercises/<id>/` (public domain, from
free-exercise-db). They are precached by the service worker (~5 MB) so they work offline. Tap an
exercise in the Exercises tab, or the info button on a workout card, to view them.

## Data model and units

Tables: `exercises`, `muscles`, `exerciseMuscles`, `sessions`, `sessionExercises`, `sets`, `settings`,
plus (schema v2) `customExercises`, `customExerciseMuscles` and `programs`. The v1 → v2 upgrade only
adds tables, so existing data is kept as is (tested against a real v1 database in
`src/db/phase3.test.ts`).
All weights are stored in **kg**; lbs exist only at the UI edge (display and input conversion,
rounded to 1 lb). For bodyweight exercises the stored weight is added load.

## Backup

Settings offers JSON export and import of user data (sessions, exercises, sets, settings) so data
can move between devices or survive a cleared browser. Backup format v2 adds the week start, target
overrides and equipment settings; v1 (phase-1) files still import and leave those settings as they are.

Backup format **v3** adds programs, custom exercises (with tombstones) and deload dismissals. v1 and
v2 files still import; sections they don't have are left untouched. Fixtures for all three live in
`src/db/__fixtures__/`.

**Encryption (optional):** with a passphrase, export wraps the JSON in a self-describing envelope
(`format: "lift-log-encrypted"`): PBKDF2-SHA-256 (iterations from `TRAINING.backup`, random salt) →
AES-GCM-256 (random IV). Import detects the envelope and asks for the passphrase; a wrong one shows
an error and writes nothing. A lost passphrase cannot be recovered.

## Programs

A program is a named weekly plan: days of ordered exercises with target sets and an optional rep
range. Built-in templates (Full Body 3×, Upper/Lower 4×, Push/Pull/Legs 6×) live in
`src/program/templates.ts` and are read-only; edit a copy. **Plan check** projects weekly weighted
sets per muscle (target sets × muscle weight, the same weights the analyzer uses) and warns below
MEV or above MRV. "Start Day N" creates a session with the day's exercises and empty set rows.
Exercises missing from My equipment are flagged with one-tap swaps.

## Progression and deload rules

Bodyweight exercises at the top of their rep range point to the next variant in
`src/data/variantChains.ts` (seed data, `SEED_VERSION` 3). Deload detection
(`src/recommend/deload.ts`, all numbers in `TRAINING.deload`) flags an exercise over its last
`lookbackSessions` sessions when the best e1RM drops by at least `e1rmDropFraction`, when average RIR
falls by at least `rirDrop` while reps fall, or after `missesToDeload` sessions missing the range.
When `exercisesForOverall` exercises are flagged, Workout and Analyze show a dismissible card
suggesting a deload week (same exercises, `setsFraction` of the sets, easy RIR). It never changes data.

## Custom exercises

Custom exercises (`custom-<uuid>` ids, so they can't collide with seed ids) live in their own tables,
so re-seeding never touches them. They have one 1.0 primary muscle and others at 0.25–1.0, and every
engine sees one merged list (`loadMergedExercises`). Deleting one with logged sets keeps a tombstone
(`deletedAt`), so history stays readable and still counts; without history it is removed.

## User Guide

Topics are Markdown files in `src/guide/content/NN-slug.md`, bundled at build time and precached, so
`/guide` works offline. Headings carry stable anchors (`## Statuses {#analyze-statuses}`) used by the
"?" buttons. **Numbers from config are never typed into content:** write placeholders such as
`{{targets.chest.mev}}` or `{{maxCountedRir}}`, resolved from `src/config/training.ts`. A unit test
fails when a placeholder doesn't resolve or a known threshold appears as a literal
(`src/guide/allowedLiterals.ts` lists the few allowed exceptions).

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
