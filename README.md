# Lift Log

An offline-first exercise log PWA. Log workouts (exercises, sets, weight, reps, RIR, warm-ups), browse
history, and keep everything on-device in IndexedDB. No account, no server; installable and fully
usable offline via a service worker.

## Requirements

- Node 20 (see `.nvmrc`).
- Install with `npx -y npm@11 i`. npm 10 crashes on vite 8.

## Scripts

| Command                                                | What it does                                              |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `npm run dev`                                          | Vite dev server                                           |
| `npm run build`                                        | Typecheck + production build (with service worker)        |
| `npm run preview`                                      | Serve the production build                                |
| `npm run check`                                        | Typecheck, lint, unit tests (vitest)                      |
| `npm run e2e`                                          | Playwright (builds and previews on :4173, 375px project)  |
| `node scripts/build-seed.mjs`                          | Regenerate seed JSON from `data/curation.json`            |
| `node scripts/fetch-images.mjs`, `optimize-images.mjs` | Fetch and optimize exercise images (see `data/README.md`) |

## Layout

- `data/` curated exercise config, raw source dump, curation notes (see `data/README.md`).
- `scripts/` seed builder and icon generation.
- `src/data/` generated seed (exercises, muscles, exercise-muscle weights) and zod schema.
- `src/db/` Dexie database and the repository layer (`sessionsRepo`, `setsRepo`, `exercisesRepo`,
  `settingsRepo`, backup, seeding, hooks). UI talks to the DB only through these.
- `src/pages/`, `src/components/` UI; `src/lib/` units and pure helpers.
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
can move between devices or survive a cleared browser.

## Seed versioning

The bundled exercise library carries `SEED_VERSION` (`src/data/index.ts`). On startup the app compares
it with the stored seed version and re-seeds only seed-owned tables (exercises, muscles,
exerciseMuscles). Re-seeding never touches user data (sessions, sets, settings, custom exercises).
Bump `SEED_VERSION` whenever the generated output changes.

## Next: analyzer

The model is built so a weekly muscle analyzer needs no schema change:

1. `sets` are indexed by `completedAt`, so a week's completed sets are one range query.
2. Each set resolves to an exercise via `sessionExercises.exerciseId`.
3. `exerciseMuscles` gives per-muscle weights: primary 1.0, secondary 0.5, with curated overrides
   in the 0.25-1.0 range.
4. Weekly sets per muscle = sum of those weights over completed, non-warm-up sets.

A pure function `weeklyMuscleSets(sets, sessionExercises, exerciseMuscles)` in `src/lib/` would
implement this (unit-testable like the rest of `src/lib`). The body map would colour muscles by that
result, and recommendations would compare it to per-muscle target ranges, both as components under
`src/components/` fed by a new hook in `src/db/hooks.ts`.
