import type { ExerciseMuscle } from '@/data';
import type { MergedExercise } from '@/data/merged';
import { db } from './db';

/** Seed + custom exercises and links. `includeDeleted` keeps tombstones (for history/name lookup). */
export async function loadMergedExercises(
  includeDeleted = false,
): Promise<{ exercises: MergedExercise[]; exerciseMuscles: ExerciseMuscle[] }> {
  const [seed, links, custom, customLinks] = await Promise.all([
    db.exercises.toArray(),
    db.exerciseMuscles.toArray(),
    db.customExercises.toArray(),
    db.customExerciseMuscles.toArray(),
  ]);
  const kept = includeDeleted ? custom : custom.filter((c) => c.deletedAt === undefined);
  const keptIds = new Set(kept.map((c) => c.id));
  return {
    exercises: [...seed, ...kept],
    exerciseMuscles: [...links, ...customLinks.filter((l) => keptIds.has(l.exerciseId))],
  };
}
