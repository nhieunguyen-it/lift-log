import { SEED_VERSION, exerciseMuscles, exercises, muscles } from '@/data';
import type { Exercise, ExerciseMuscle, Muscle } from '@/data';
import { db } from './db';
import { getSeedVersion } from './settingsRepo';

export interface SeedPayload {
  version: number;
  muscles: Muscle[];
  exercises: Exercise[];
  exerciseMuscles: ExerciseMuscle[];
}

export const bundledSeed: SeedPayload = {
  version: SEED_VERSION,
  muscles,
  exercises,
  exerciseMuscles,
};

/**
 * Replaces ONLY muscles/exercises/exerciseMuscles when the stored seed version
 * is older than the payload's. User data and settings (except seedVersion)
 * are never touched. Returns true if a reseed happened.
 */
export async function ensureSeed(seed: SeedPayload = bundledSeed): Promise<boolean> {
  const stored = await getSeedVersion();
  if (stored >= seed.version) return false;
  await db.transaction(
    'rw',
    [db.muscles, db.exercises, db.exerciseMuscles, db.settings],
    async () => {
      await Promise.all([db.muscles.clear(), db.exercises.clear(), db.exerciseMuscles.clear()]);
      await db.muscles.bulkAdd(seed.muscles);
      await db.exercises.bulkAdd(seed.exercises);
      await db.exerciseMuscles.bulkAdd(seed.exerciseMuscles);
      await db.settings.put({ key: 'seedVersion', value: seed.version });
    },
  );
  return true;
}
