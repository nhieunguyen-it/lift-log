import { planSets, resolveRepRange } from '@/analysis/recommend';
import type { HistorySet, PlannedSet } from '@/analysis/recommend';
import type { SessionExercise } from '@/analysis/rows';
import { systemOf } from '@/program/systems';
import { db } from './db';
import { getExerciseWithMuscles } from './exercisesRepo';
import { earlierSessionExerciseIds } from './previousSessions';
import { getUnit } from './settingsRepo';

/** Working sets of the most recent earlier session that has sets for this exercise, in order. */
async function previousWorkingSets(sessionExerciseId: string): Promise<HistorySet[]> {
  for (const id of await earlierSessionExerciseIds(sessionExerciseId)) {
    const rows = await db.sets.where('sessionExerciseId').equals(id).toArray();
    if (rows.length === 0) continue;
    return rows
      .sort((a, b) => a.order - b.order)
      .filter((s) => !s.isWarmup)
      .map((s) => ({ weightKg: s.weightKg, reps: s.reps }));
  }
  return [];
}

/**
 * Plans the working sets for a session exercise from its training-system snapshot and the
 * previous session. `sets` defaults to the current number of set rows.
 */
export async function planForSessionExercise(
  se: SessionExercise,
  opts: { sets?: number; deloadWeek?: boolean } = {},
): Promise<PlannedSet[]> {
  const [history, found, unit, current] = await Promise.all([
    previousWorkingSets(se.id),
    getExerciseWithMuscles(se.exerciseId),
    getUnit(),
    opts.sets === undefined
      ? db.sets.where('sessionExerciseId').equals(se.id).count()
      : Promise.resolve(opts.sets),
  ]);
  if (!found) return [];
  const system = systemOf(se);
  return planSets({
    system,
    repRange: resolveRepRange(system, se.repRange, found.exercise),
    sets: current,
    history,
    exercise: found.exercise,
    primaryMuscleIds: found.muscles.filter((m) => m.weight === 1).map((m) => m.muscleId),
    unit,
    deloadWeek: opts.deloadWeek,
  });
}
