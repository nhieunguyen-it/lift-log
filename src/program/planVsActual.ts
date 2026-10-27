/** Phase 4: plan vs. actual for one week. Pure; no React or Dexie. */
import { MUSCLE_IDS } from '@/data';
import type { WeekAnalysis } from '@/analyzer/types';
import type { Session } from '@/db/types';
import type { PlanCheck, PlanVsActual, PlanVsActualMuscle, ProgramDay } from './types';

/**
 * Compares a week's projected sets (a program's plan check, or a block week's) with the
 * analyzed week. A day counts as done when a session tagged with its id started inside
 * the week window; every other day is listed as skipped (not done).
 */
export function comparePlanToActual(
  plan: PlanCheck,
  week: WeekAnalysis,
  days: Pick<ProgramDay, 'id' | 'name'>[],
  sessions: Pick<Session, 'startedAt' | 'programDayId'>[],
): PlanVsActual {
  const muscles: PlanVsActualMuscle[] = [];
  for (const id of MUSCLE_IDS) {
    const planned = plan.muscles[id].sets;
    const actual = week.muscles[id].sets;
    if (planned === 0 && actual === 0) continue;
    muscles.push({ muscleId: id, planned, actual, gap: actual - planned });
  }
  muscles.sort((a, b) => a.gap - b.gap || a.muscleId.localeCompare(b.muscleId));

  const doneIds = new Set(
    sessions
      .filter((s) => s.startedAt >= week.window.start && s.startedAt < week.window.end)
      .map((s) => s.programDayId),
  );
  const dayRows = days.map((d) => ({ dayId: d.id, name: d.name, done: doneIds.has(d.id) }));
  const daysDone = dayRows.filter((d) => d.done).length;
  return { muscles, days: dayRows, daysDone, daysSkipped: dayRows.length - daysDone };
}
