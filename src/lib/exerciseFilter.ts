import type { Equipment } from '@/data';
import type { ExerciseWithMuscles } from '@/db/exercisesRepo';

export interface ExerciseFilter {
  query: string;
  muscleId?: string;
  equipment?: Equipment;
  /** Only user-created exercises. */
  customOnly?: boolean;
  /** Exercise ids, most recent first; used to sort when provided. */
  recentIds?: string[];
}

const norm = (s: string) => s.toLowerCase().trim();

export function filterExercises(
  list: ExerciseWithMuscles[],
  { query, muscleId, equipment, customOnly, recentIds = [] }: ExerciseFilter,
): ExerciseWithMuscles[] {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  const rank = new Map(recentIds.map((id, i) => [id, i]));
  return list
    .filter(({ exercise, muscles }) => {
      if (exercise.deletedAt !== undefined) return false;
      if (customOnly && !exercise.isCustom) return false;
      if (equipment && exercise.equipment !== equipment) return false;
      if (muscleId && !muscles.some((m) => m.muscleId === muscleId && m.weight >= 0.5)) {
        return false;
      }
      const hay = [exercise.name, ...exercise.aliases].map(norm).join(' | ');
      return tokens.every((t) => hay.includes(t));
    })
    .sort((a, b) => {
      const ra = rank.get(a.exercise.id) ?? Infinity;
      const rb = rank.get(b.exercise.id) ?? Infinity;
      if (ra !== rb) return ra - rb;
      return a.exercise.name.localeCompare(b.exercise.name);
    });
}
