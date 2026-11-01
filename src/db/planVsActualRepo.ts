import { planVsActual } from '@/analysis';
import type { PlanVsActualView } from '@/analysis';
import { loadAnalysisInput } from './localAnalysisClient';

export type { PlanVsActualView };

/** Phase 4: the active program's plan (or its block week) vs. the week's log. Null without a program. */
export async function getPlanVsActual(
  refTs: number,
  now = Date.now(),
): Promise<PlanVsActualView | null> {
  return planVsActual(await loadAnalysisInput(now), refTs);
}
