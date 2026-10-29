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

Backup format **v4** adds running program blocks (`settings.programBlocks`, keyed by program id),
the Analyze grouping choice and optional session tags (`programId`, `programDayId`, `blockWeek`).
v1–v3 files still import (fixture per version). Blocks live in settings rather than on program rows
so read-only built-in templates can run them too; none of this needed a Dexie schema bump (the
schema stays at v2: the new session fields are not indexed).

Backup format **v5** adds the optional exporting profile's name (see Profiles). v1–v4 still import.

**Encryption (optional):** with a passphrase, export wraps the JSON in a self-describing envelope
(`format: "lift-log-encrypted"`): PBKDF2-SHA-256 (iterations from `TRAINING.backup`, random salt) →
AES-GCM-256 (random IV). Import detects the envelope and asks for the passphrase; a wrong one shows
an error and writes nothing. A lost passphrase cannot be recovered.

## Profiles

Several people (or several training contexts) can share one device. Everything stays local: no
accounts, no network.

- **Storage layout.** One IndexedDB database per profile. A small registry database,
  `lift-log-profiles` (table `profiles`: `id`, `name`, `createdAt`, `lastUsedAt`, optional `color`;
  plus a `meta` table holding the active profile id), lists them.
- **Default mapping.** The profile with id `default` is the original `lift-log` database, opened
  as is: existing users keep their data with no migration and no copying. Every other profile
  uses `lift-log-p-<uuid>`.
- **Startup and switching.** `main.tsx` resolves the active profile from the registry and binds
  the `db` singleton (`bindDb`, `src/db/db.ts`) before rendering. Switching sets the active id and
  reloads the page, so every live query binds to the new database. Nothing is hot-swapped.
- **Per profile.** Seed tables (`ensureSeed()` runs per database), sessions, settings, programs,
  blocks, custom exercises, deload dismissals and the onboarding / What's new flags. A new profile
  shows onboarding and skips What's new.
- **Names and limits.** Letters, digits, space, `_` and `-`; trimmed; unique case-insensitively.
  Max profiles, name lengths and the switcher list size live in `src/config/profiles.ts`.
- **Deletion.** You can't delete the active profile or the only profile. Deleting runs
  `Dexie.delete` on that profile's database only, then removes its registry row. It is
  irreversible and asks you to type the name first.
- **Backup v5.** Export and import act on the active profile. v5 adds an optional
  `profile: { name }`; importing into the current profile ignores it, importing into a new profile
  uses it as the default name. v1-v4 files still import; encryption is unchanged.
- **Not a security boundary.** There is no PIN or password. Anyone with access to the browser can
  switch profiles and the data is not encrypted at rest. Profiles keep training logs apart, not
  secret.

## Programs

A program is a named weekly plan: days of ordered exercises with target sets and an optional rep
range. Built-in templates (Full Body 3×, Upper/Lower 4×, Push/Pull/Legs 6×) live in
`src/program/templates.ts` and are read-only; edit a copy. **Plan check** projects weekly weighted
sets per muscle (target sets × muscle weight, the same weights the analyzer uses) and warns below
MEV or above MRV. "Start Day N" creates a session with the day's exercises and empty set rows.
Exercises missing from My equipment are flagged with one-tap swaps.

**Blocks (mesocycles).** Any program can run as a block of `TRAINING.blocks.defaultWeeks` weeks
(`minWeeks`–`maxWeeks`). Chosen exercises (default: each day's first) gain `ramp.setsPerWeek` sets per
week, at most `ramp.maxExtraSets` above base; the final week is a planned deload (every exercise at
`deload.setsFraction` of its base sets, min 1, easy RIR). `projectBlock` (`src/program/block.ts`)
returns each week's sets and plan check plus MRV warnings; the current week is derived from the block
start and the week-start setting. The program view shows a week strip; "Start Day N" uses the current
block week's sets and tags the session with the program day and block week.

**Plan vs. actual.** With a program active, Analyze compares the week's plan (or block week) with
what was logged (`comparePlanToActual`, `src/program/planVsActual.ts`): muscles that fell short first,
plus days done and skipped (shown as "not done yet" while the week runs).

## Progression and deload rules

Bodyweight exercises at the top of their rep range point to the next variant in
`src/data/variantChains.ts` (seed data, `SEED_VERSION` 4; e.g. incline push-up → push-up → decline push-up → dip). Deload detection
(`src/recommend/deload.ts`, all numbers in `TRAINING.deload`) flags an exercise over its last
`lookbackSessions` sessions when the best e1RM drops by at least `e1rmDropFraction`, when average RIR
falls by at least `rirDrop` while reps fall, or after `missesToDeload` sessions missing the range.
When `exercisesForOverall` exercises are flagged, Workout and Analyze show a dismissible card
suggesting a deload week (same exercises, `setsFraction` of the sets, easy RIR). It never changes data.
When a single exercise is flagged without an overall signal, its workout target chip shows a small
dismissible hint instead (same dismissal storage, keyed per exercise).

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

## Analyze design

The Analyze tab reads top to bottom without scrolling at 375px: a summary card (`summarizeWeek`:
hard sets, Δ vs last week, a segmented status bar with text counts), then Needs attention (over MRV
first, then below MEV), Plan vs. actual (with a program), the body map, suggestions, a collapsed
12-week trend and the muscle list. The deload card only appears when active. Muscle rows show a range
bar (MEV, MAV band, MRV, current value; scale ends at `charts.rangeBarHeadroom` × MRV) and a
`charts.sparklineWeeks` sparkline, each with screen-reader text, grouped by muscle or by push / pull /
legs / core (remembered). The legend doubles as a filter. Status colours and chart colours are theme
tokens in `src/index.css` (`--st-*`, `--chart-*`) for light and dark; `src/lib/contrast.test.ts` checks
WCAG AA, and status is always shown with a label or pattern as well. Body map shapes come from
MuscleMap (see Credits); the map is lazy-loaded.

Seed v4 adds arm isolation (dumbbell and cable curls, triceps pushdown, cable overhead extension)
and incline/decline push-ups; the built-in templates were rebalanced so biceps and triceps land
inside MAV in all three (16/16, 16.5/16, 16.5/16 weighted sets) with nothing above MRV.

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

## Deploy

Hosted on Vercel via Git integration: import the GitHub repo in the Vercel dashboard (framework
preset Vite, no env vars). Pushes to `main` deploy to production; other branches get preview URLs.
`vercel.json` holds the settings:

- `installCommand` is `npx -y npm@11 ci` because Vercel's images ship npm 10, which crashes on vite 8.
- Every path rewrites to `index.html` so `BrowserRouter` deep links survive a reload (real files are
  served first).
- `sw.js` and `index.html` are `no-cache` so the `autoUpdate` service worker picks up new deploys;
  hashed `/assets/*` are cached immutably.

## Credits

The Analyze body map anatomy is derived from [MuscleMap](https://github.com/melihcolpan/MuscleMap) by Melih Colpan (MIT). See `THIRD_PARTY_NOTICES.md`.
