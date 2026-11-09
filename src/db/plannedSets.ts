import { planSets, resolveRepRange } from '@/analysis/recommend';
import type { HistorySet, PlannedSet } from '@/analysis/recommend';
import type { SessionExercise, SetRow } from '@/analysis/rows';
import { isDeloadWeek } from '@/program/block';
import { systemOf } from '@/program/systems';
import { db } from './db';
import { getExerciseWithMuscles } from './exercisesRepo';
import { earlierSessionExerciseIds } from './previousSessions';
import { getProgramBlocks, getUnit } from './settingsRepo';

/**
 * Done (ticked) working sets of the most recent earlier session that has any for this
 * exercise, in order. Unticked rows (e.g. pre-filled but skipped) are not history.
 */
async function previousWorkingSets(sessionExerciseId: string): Promise<HistorySet[]> {
  for (const id of await earlierSessionExerciseIds(sessionExerciseId)) {
    const rows = (await db.sets.where('sessionExerciseId').equals(id).toArray()).filter(
      (s) => !s.isWarmup && s.completedAt !== undefined,
    );
    if (rows.length === 0) continue;
    return rows
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ weightKg: s.weightKg, reps: s.reps }));
  }
  return [];
}

/**
 * Whether a session was started in its program block's deload week, judged against the
 * program's current block (as startProgramDay does). False for ad-hoc sessions.
 */
export async function deloadWeekForSession(sessionId: string): Promise<boolean> {
  const session = await db.sessions.get(sessionId);
  if (!session?.programId || session.blockWeek === undefined) return false;
  const block = (await getProgramBlocks())[session.programId];
  return !!block && isDeloadWeek(block, session.blockWeek);
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

/**
 * Per index, the empty fields of a not-done row that the plan can fill. Done rows, rows beyond
 * the plan and fields that already hold a value are skipped.
 */
export function fillFromPlan(
  sets: SetRow[],
  plan: PlannedSet[],
): { id: string; patch: { weightKg?: number; reps?: number } }[] {
  const out: { id: string; patch: { weightKg?: number; reps?: number } }[] = [];
  sets.forEach((row, i) => {
    const p = plan[i];
    if (!p || row.completedAt !== undefined) return;
    const patch: { weightKg?: number; reps?: number } = {};
    if (p.weightKg !== undefined && row.weightKg === undefined) patch.weightKg = p.weightKg;
    if (row.reps === 0 && p.reps > 0) patch.reps = p.reps;
    if (Object.keys(patch).length > 0) out.push({ id: row.id, patch });
  });
  return out;
}
