import { useLiveQuery } from 'dexie-react-hooks';
import { getPlanVsActual } from './planVsActualRepo';
import type { PlanVsActualView } from './planVsActualRepo';

export type { PlanVsActualView };

/** `undefined` while loading, `null` when no program is active. */
export const usePlanVsActual = (refTs: number): PlanVsActualView | null | undefined =>
  useLiveQuery(() => getPlanVsActual(refTs), [refTs]);
