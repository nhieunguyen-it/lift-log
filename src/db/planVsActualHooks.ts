import { useLiveQuery } from 'dexie-react-hooks';
import type { PlanVsActualView } from '@/analysis';
import { analysisClient } from './localAnalysisClient';

export type { PlanVsActualView };

/** `undefined` while loading, `null` when no program is active. */
export const usePlanVsActual = (refTs: number): PlanVsActualView | null | undefined =>
  useLiveQuery(() => analysisClient.getPlanVsActual(refTs), [refTs]);
