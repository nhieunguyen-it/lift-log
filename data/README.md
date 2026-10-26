# Seed data

Exercise and muscle seed data for Lift Log.

- **Source:** [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), `dist/exercises.json`
- **License:** Unlicense (public domain)
- **Downloaded:** 2026-10-26 to `data/raw/free-exercise-db.json`
- The raw file is treated as untrusted data: it is only ever parsed as JSON.
- `data/curation.json` is the hand-curated config: which source exercises are used, their
  final id/name/equipment/force/mechanic/level, search aliases and the reviewed muscle weights
  (`"m": "chest,front_delts:.5"` where an omitted weight means 1.0). Reasons for non-default
  weights are in each entry's `note` and summarised in `CURATION.md`.

## Regenerate

```sh
export PATH=$HOME/.nvm/versions/node/v20.20.2/bin:$PATH
curl -sL https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json -o data/raw/free-exercise-db.json
node scripts/build-seed.mjs
```

The script writes `src/data/exercises.json` and `src/data/exerciseMuscles.json` (sorted, deterministic),
prints per-muscle coverage, and exits non-zero on any rule violation. Bump `SEED_VERSION` in
`src/data/index.ts` whenever the output changes.

## Muscle mapping (source name -> muscle id)

Used when an entry in `curation.json` has no explicit `m` list (the default is primary = 1.0,
secondary = 0.5; the highest weight wins on collisions). Every shipped exercise has a hand-reviewed
`m`, so this table is mostly the starting point for the review.

| free-exercise-db | Lift Log id | Notes                                              |
| ---------------- | ----------- | -------------------------------------------------- |
| abdominals       | abs         | `obliques` has no source equivalent; set by hand   |
| shoulders        | front_delts | source does not split delts; side/rear set by hand |
| chest            | chest       |                                                    |
| lats             | lats        |                                                    |
| middle back      | upper_back  |                                                    |
| traps            | upper_back  | upper_back = traps + rhomboids                     |
| lower back       | lower_back  |                                                    |
| biceps           | biceps      |                                                    |
| triceps          | triceps     |                                                    |
| forearms         | forearms    |                                                    |
| glutes           | glutes      |                                                    |
| abductors        | glutes      | no abductor id; gluteus medius is the closest      |
| quadriceps       | quads       |                                                    |
| hamstrings       | hamstrings  |                                                    |
| adductors        | adductors   |                                                    |
| calves           | calves      |                                                    |
| neck             | (dropped)   | no neck id                                         |

## Enums

- equipment: barbell, dumbbell, cable, machine, bodyweight, kettlebell, band, other
  (`body only` -> bodyweight, `kettlebells` -> kettlebell, `bands` -> band, other/null -> other)
- force: push, pull, static, legs (`legs` is set by hand for squat/lunge patterns)
- mechanic: compound, isolation; level: beginner, intermediate, expert
