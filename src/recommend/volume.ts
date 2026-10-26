import type { Equipment, Exercise, ExerciseMuscle, MuscleId } from '@/data';
import { MUSCLE_IDS } from '@/data';
import { TRAINING } from '@/config/training';
import type { TrainingConfig } from '@/config/training';
import type { WeekAnalysis } from '@/analyzer/types';
import type { VolumeSuggestion } from './types';

export function isAvailable(ex: Exercise, available: readonly Equipment[]): boolean {
  return ex.equipment === 'bodyweight' || available.includes(ex.equipment);
}

export function volumeSuggestions(args: {
  week: WeekAnalysis;
  exercises: Exercise[];
  exerciseMuscles: ExerciseMuscle[];
  availableEquipment: readonly Equipment[];
  config?: TrainingConfig;
}): VolumeSuggestion[] {
  const { week, exercises, exerciseMuscles, availableEquipment } = args;
  const config = args.config ?? TRAINING;
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const muscleCount = new Map<string, number>();
  for (const em of exerciseMuscles) {
    muscleCount.set(em.exerciseId, (muscleCount.get(em.exerciseId) ?? 0) + 1);
  }

  const adds: Array<Extract<VolumeSuggestion, { kind: 'add' }>> = [];
  const overs: Array<Extract<VolumeSuggestion, { kind: 'over' }>> = [];

  for (const muscleId of MUSCLE_IDS as readonly MuscleId[]) {
    const mw = week.muscles[muscleId];
    if (!mw) continue;
    const { sets, target } = mw;
    if (sets < target.mev) {
      const candidates = exerciseMuscles
        .filter((em) => em.muscleId === muscleId)
        .map((em) => ({ em, ex: byId.get(em.exerciseId) }))
        .filter(
          (c): c is { em: ExerciseMuscle; ex: Exercise } =>
            !!c.ex && isAvailable(c.ex, availableEquipment),
        )
        .sort(
          (a, b) =>
            b.em.weight - a.em.weight ||
            (muscleCount.get(a.ex.id) ?? 0) - (muscleCount.get(b.ex.id) ?? 0) ||
            a.ex.name.localeCompare(b.ex.name),
        )
        .slice(0, config.volumeSuggestions.exercisesPerMuscle);
      adds.push({
        kind: 'add',
        muscleId,
        current: sets,
        mev: target.mev,
        // Epsilon guards float sums of fractional weights (7.0000001 must not round up).
        setsToAdd: Math.ceil(target.mev - sets - 1e-9),
        exercises: candidates.map((c) => ({ exerciseId: c.ex.id, muscleWeight: c.em.weight })),
      });
    } else if (sets > target.mrv) {
      overs.push({ kind: 'over', muscleId, current: sets, mrv: target.mrv });
    }
  }
  adds.sort((a, b) => b.mev - b.current - (a.mev - a.current));
  return [...adds, ...overs];
}
