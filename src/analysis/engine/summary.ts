import { MUSCLE_IDS } from '@/data';
import type { AttentionItem, MuscleStatus, WeekAnalysis, WeekSummary } from './types';

/** Unweighted hard sets: each exercise's counted sets, taken once across muscles. */
function hardSets(week: WeekAnalysis): number {
  const perExercise = new Map<string, number>();
  for (const id of MUSCLE_IDS) {
    for (const c of week.muscles[id].contributions) {
      perExercise.set(c.exerciseId, Math.max(perExercise.get(c.exerciseId) ?? 0, c.sets));
    }
  }
  let total = 0;
  for (const n of perExercise.values()) total += n;
  return total;
}

/**
 * Phase 4: at-a-glance numbers for the Analyze summary card. Pure; reads only the two
 * week analyses (and session counts when a program is active).
 */
export function summarizeWeek(
  current: WeekAnalysis,
  previous: WeekAnalysis | undefined,
  program?: { sessionsDone: number; plannedSessions: number },
): WeekSummary {
  const statusCounts: Record<MuscleStatus, number> = {
    none: 0,
    below: 0,
    building: 0,
    optimal: 0,
    high: 0,
    over: 0,
  };
  const over: AttentionItem[] = [];
  const below: AttentionItem[] = [];
  for (const id of MUSCLE_IDS) {
    const m = current.muscles[id];
    statusCounts[m.status]++;
    if (m.status === 'over') {
      over.push({ muscleId: id, status: 'over', sets: m.sets, threshold: m.target.mrv });
    } else if (m.status === 'below') {
      below.push({ muscleId: id, status: 'below', sets: m.sets, threshold: m.target.mev });
    }
  }
  const dist = (a: AttentionItem) => Math.abs(a.sets - a.threshold);
  const byDist = (a: AttentionItem, b: AttentionItem) =>
    dist(b) - dist(a) || a.muscleId.localeCompare(b.muscleId);
  const totalSets = hardSets(current);
  const previousTotalSets = previous ? hardSets(previous) : 0;
  return {
    totalSets,
    previousTotalSets,
    delta: totalSets - previousTotalSets,
    statusCounts,
    needsAttention: [...over.sort(byDist), ...below.sort(byDist)],
    sessions: program
      ? { done: program.sessionsDone, planned: program.plannedSessions }
      : undefined,
  };
}
