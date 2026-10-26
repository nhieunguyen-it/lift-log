import { useLiveQuery } from 'dexie-react-hooks';
import type { E1rmPoint } from '@/analyzer';
import type { DeloadSignal } from '@/recommend';
import { dismissDeload, getDeloadSignal, getE1rmHistory, getLongTrend } from './progressRepo';
import type { LongTrend } from './progressRepo';

export { dismissDeload };

/** `undefined` while loading, `null` when there is nothing to suggest. */
export const useDeloadSignal = (): DeloadSignal | null | undefined =>
  useLiveQuery(() => getDeloadSignal(), []);

/** Weekly volume per muscle over the long trend window (live). */
export const useLongTrend = (refTs?: number): LongTrend | undefined =>
  useLiveQuery(() => getLongTrend(refTs), [refTs]);

/** e1RM per session for an exercise, oldest first. */
export const useE1rmHistory = (exerciseId: string | undefined): E1rmPoint[] | undefined =>
  useLiveQuery(async () => (exerciseId ? await getE1rmHistory(exerciseId) : []), [exerciseId]);
