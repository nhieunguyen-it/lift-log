#!/usr/bin/env node
// Builds src/data/exercises.json and src/data/exerciseMuscles.json from
// data/raw/free-exercise-db.json (untrusted, parsed as JSON only) and the
// hand-curated config data/curation.json. Deterministic: output is sorted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data/raw/free-exercise-db.json');
const CURATION = path.join(ROOT, 'data/curation.json');
const OUT_DIR = path.join(ROOT, 'src/data');

const MUSCLE_IDS = [
  'chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'lats',
  'upper_back',
  'lower_back',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
];
const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
];
const FORCES = ['push', 'pull', 'static', 'legs'];
const MECHANICS = ['compound', 'isolation'];
const LEVELS = ['beginner', 'intermediate', 'expert'];

// free-exercise-db muscle name -> our muscle id (see data/README.md).
// null = dropped. 'shoulders' defaults to front_delts; abdominals has no oblique split.
const MUSCLE_MAP = {
  abdominals: 'abs',
  abductors: 'glutes',
  adductors: 'adductors',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'chest',
  forearms: 'forearms',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  lats: 'lats',
  'lower back': 'lower_back',
  'middle back': 'upper_back',
  neck: null,
  quadriceps: 'quads',
  shoulders: 'front_delts',
  traps: 'upper_back',
  triceps: 'triceps',
};
const EQUIPMENT_MAP = {
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  cable: 'cable',
  machine: 'machine',
  'body only': 'bodyweight',
  kettlebells: 'kettlebell',
  bands: 'band',
};

const errors = [];
const fail = (msg) => errors.push(msg);

const raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));
const cfg = JSON.parse(fs.readFileSync(CURATION, 'utf8'));
const rawById = new Map(raw.map((r) => [r.id, r]));

function parseMuscles(spec, where) {
  const res = new Map();
  for (const part of spec.split(',')) {
    const [id, w] = part.trim().split(':');
    const weight = w === undefined ? 1 : Number(w);
    if (!MUSCLE_IDS.includes(id)) fail(`${where}: unknown muscle "${id}"`);
    else if (!(weight >= 0.25 && weight <= 1))
      fail(`${where}: weight ${weight} out of [0.25,1] for ${id}`);
    else if (res.has(id)) fail(`${where}: duplicate muscle ${id}`);
    else res.set(id, weight);
  }
  return res;
}

function autoMuscles(r) {
  const res = new Map();
  const add = (name, weight) => {
    const id = MUSCLE_MAP[name];
    if (id) res.set(id, Math.max(res.get(id) ?? 0, weight));
  };
  r.secondaryMuscles.forEach((m) => add(m, 0.5));
  r.primaryMuscles.forEach((m) => add(m, 1));
  return res;
}

const exercises = [];
const links = [];
const seenIds = new Set();
const seenSrc = new Set();

for (const c of cfg) {
  const where = `exercise ${c.id}`;
  const r = rawById.get(c.src);
  if (!r) {
    fail(`${where}: source id "${c.src}" not found in raw data`);
    continue;
  }
  if (seenIds.has(c.id)) fail(`${where}: duplicate id`);
  seenIds.add(c.id);
  if (seenSrc.has(c.src)) fail(`${where}: source ${c.src} used twice`);
  seenSrc.add(c.src);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) fail(`${where}: id is not a kebab slug`);

  const equipment = c.eq ?? EQUIPMENT_MAP[r.equipment] ?? 'other';
  const force = c.force ?? r.force;
  const mechanic = c.mech ?? r.mechanic;
  const level = c.level ?? r.level;
  if (!EQUIPMENT.includes(equipment)) fail(`${where}: bad equipment ${equipment}`);
  if (!FORCES.includes(force)) fail(`${where}: bad force ${force}`);
  if (!MECHANICS.includes(mechanic)) fail(`${where}: bad mechanic ${mechanic}`);
  if (!LEVELS.includes(level)) fail(`${where}: bad level ${level}`);

  exercises.push({
    id: c.id,
    name: c.name,
    equipment,
    force,
    mechanic,
    isBodyweight: c.bw === true || equipment === 'bodyweight',
    level,
    aliases: [...new Set(c.al ?? [])].sort(),
    source: c.src,
  });

  const muscles = c.m ? parseMuscles(c.m, where) : autoMuscles(r);
  if (![...muscles.values()].includes(1)) fail(`${where}: no muscle with weight 1.0`);
  for (const [muscleId, weight] of muscles) links.push({ exerciseId: c.id, muscleId, weight });
}

exercises.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
links.sort((a, b) =>
  a.exerciseId !== b.exerciseId
    ? a.exerciseId < b.exerciseId
      ? -1
      : 1
    : a.muscleId < b.muscleId
      ? -1
      : a.muscleId > b.muscleId
        ? 1
        : 0,
);

if (exercises.length < 60 || exercises.length > 80)
  fail(`exercise count ${exercises.length} not within 60-80`);

const coverage = Object.fromEntries(MUSCLE_IDS.map((m) => [m, 0]));
for (const l of links) coverage[l.muscleId] += 1;
for (const m of MUSCLE_IDS)
  if (coverage[m] < 2) fail(`muscle ${m} covered by only ${coverage[m]} exercise(s)`);

console.log(`exercises: ${exercises.length}, exerciseMuscles: ${links.length}`);
console.log('per-muscle coverage:');
for (const m of MUSCLE_IDS) console.log(`  ${m.padEnd(12)} ${coverage[m]}`);
const nonStandard = links.filter((l) => l.weight !== 0.5 && l.weight !== 1);
console.log(`non-standard weights (overrides): ${nonStandard.length}`);
const isoCount = exercises.filter((e) => e.mechanic === 'isolation').map((e) => e.id);
console.log(`isolation exercises (${isoCount.length}): ${isoCount.join(', ')}`);

if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'exercises.json'), JSON.stringify(exercises, null, 2) + '\n');
fs.writeFileSync(path.join(OUT_DIR, 'exerciseMuscles.json'), JSON.stringify(links, null, 2) + '\n');
console.log('wrote src/data/exercises.json and src/data/exerciseMuscles.json');
