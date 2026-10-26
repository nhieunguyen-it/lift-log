/** Pure weekly-volume projection for a program. No React or Dexie. */
import { MUSCLE_IDS } from '@/data';
import type { Exercise, ExerciseMuscle, MuscleId } from '@/data';
import type { VolumeTarget } from '@/config/training';
import { statusFor } from '@/analyzer/volume';
import type { PlanCheck, PlanMuscle, PlanWarning, Program } from './types';

/**
 * Projects weekly weighted sets per muscle as if every day were done once:
 * sum over days/exercises of targetSets x muscle weight.
 */
export function planCheck(
  program: Pick<Program, 'days'>,
  exercises: Pick<Exercise, 'id'>[],
  exerciseMuscles: ExerciseMuscle[],
  targets: Record<MuscleId, VolumeTarget>,
): PlanCheck {
  const known = new Set(exercises.map((e) => e.id));
  const weights = new Map<string, ExerciseMuscle[]>();
  for (const em of exerciseMuscles) {
    const list = weights.get(em.exerciseId);
    if (list) list.push(em);
    else weights.set(em.exerciseId, [em]);
  }

  const totals = {} as Record<MuscleId, number>;
  const contribs = {} as Record<MuscleId, Map<string, number>>;
  for (const id of MUSCLE_IDS) {
    totals[id] = 0;
    contribs[id] = new Map();
  }
  const unknown = new Set<string>();

  for (const day of program.days) {
    for (const ex of day.exercises) {
      if (!known.has(ex.exerciseId)) {
        unknown.add(ex.exerciseId);
        continue;
      }
      for (const { muscleId, weight } of weights.get(ex.exerciseId) ?? []) {
        const m = muscleId as MuscleId;
        const w = ex.targetSets * weight;
        totals[m] += w;
        contribs[m].set(ex.exerciseId, (contribs[m].get(ex.exerciseId) ?? 0) + w);
      }
    }
  }

  const muscles = {} as Record<MuscleId, PlanMuscle>;
  const warnings: PlanWarning[] = [];
  for (const id of MUSCLE_IDS) {
    const target = targets[id];
    const sets = totals[id];
    muscles[id] = {
      muscleId: id,
      sets,
      status: statusFor(sets, target),
      target,
      contributions: [...contribs[id]]
        .map(([exerciseId, weightedSets]) => ({ exerciseId, weightedSets }))
        .sort((a, b) => b.weightedSets - a.weightedSets),
    };
    if (sets < target.mev) {
      warnings.push({ muscleId: id, kind: 'below_mev', sets, threshold: target.mev });
    } else if (sets > target.mrv) {
      warnings.push({ muscleId: id, kind: 'above_mrv', sets, threshold: target.mrv });
    }
  }
  return { muscles, warnings, unknownExerciseIds: [...unknown] };
}
