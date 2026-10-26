import type { ExerciseMuscle } from '@/data';
import type { MergedExercise } from '@/data/merged';
import { db } from './db';
import { loadMergedExercises } from './customExercisesRepo';

export interface ExerciseWithMuscles {
  exercise: MergedExercise;
  muscles: ExerciseMuscle[];
}

export async function listExercisesWithMuscles(): Promise<ExerciseWithMuscles[]> {
  const { exercises, exerciseMuscles: links } = await loadMergedExercises();
  const byEx = new Map<string, ExerciseMuscle[]>();
  for (const l of links) {
    const arr = byEx.get(l.exerciseId) ?? [];
    arr.push(l);
    byEx.set(l.exerciseId, arr);
  }
  return exercises
    .map((exercise) => ({
      exercise,
      muscles: (byEx.get(exercise.id) ?? []).sort((a, b) => b.weight - a.weight),
    }))
    .sort((a, b) => a.exercise.name.localeCompare(b.exercise.name));
}

export async function listMuscles() {
  return db.muscles.toArray();
}

/** Exercise ids ordered by most recent use (most recent session first). */
export async function recentExerciseIds(limit = 30): Promise<string[]> {
  const sessions = await db.sessions.orderBy('startedAt').reverse().limit(60).toArray();
  const seen: string[] = [];
  for (const s of sessions) {
    const ses = await db.sessionExercises.where('sessionId').equals(s.id).toArray();
    ses.sort((a, b) => b.order - a.order);
    for (const se of ses) {
      if (!seen.includes(se.exerciseId)) seen.push(se.exerciseId);
    }
    if (seen.length >= limit) break;
  }
  return seen.slice(0, limit);
}

export async function getExerciseWithMuscles(id: string): Promise<ExerciseWithMuscles | null> {
  const exercise = (await db.exercises.get(id)) ?? (await db.customExercises.get(id));
  if (!exercise) return null;
  const table = exercise.id.startsWith('custom-') ? db.customExerciseMuscles : db.exerciseMuscles;
  const links = await table.where('exerciseId').equals(id).toArray();
  return { exercise, muscles: links.sort((a, b) => b.weight - a.weight) };
}
