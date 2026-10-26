import { useLiveQuery } from 'dexie-react-hooks';
import type { MergedExercise } from '@/data/merged';
import { DELETED_EXERCISE_NAME } from '@/data/merged';
import { db } from './db';
import { loadMergedExercises } from './customExercisesRepo';

/** Every exercise (seed, custom and tombstones) by id, for resolving names in history views. */
export const useExerciseLookup = (): Map<string, MergedExercise> | undefined =>
  useLiveQuery(async () => {
    const { exercises } = await loadMergedExercises(true);
    return new Map(exercises.map((e) => [e.id, e]));
  }, []);

/** Name for an exercise id; unknown ids show "Deleted exercise". */
export function nameFor(lookup: Map<string, MergedExercise> | undefined, id: string): string {
  return lookup?.get(id)?.name ?? (lookup ? DELETED_EXERCISE_NAME : id);
}

/** Live count of logged sets per exercise id (for delete confirmation). */
export const useLoggedSetCount = (exerciseId: string | undefined) =>
  useLiveQuery(async () => {
    if (!exerciseId) return 0;
    const ses = await db.sessionExercises.where('exerciseId').equals(exerciseId).toArray();
    let n = 0;
    for (const se of ses) n += await db.sets.where('sessionExerciseId').equals(se.id).count();
    return n;
  }, [exerciseId]);
