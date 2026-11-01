import { useLiveQuery } from 'dexie-react-hooks';
import type { DeloadSignal, E1rmPoint, ExerciseDeloadHint, LongTrend } from '@/analysis';
import { analysisClient } from './localAnalysisClient';
import { dismissDeload } from './progressRepo';

export { dismissDeload };
export type { ExerciseDeloadHint, LongTrend };

/** `undefined` while loading, `null` when there is nothing to suggest. */
export const useDeloadSignal = (): DeloadSignal | null | undefined =>
  useLiveQuery(() => analysisClient.getDeloadSignal(), []);

/** Weekly volume per muscle over the long trend window (live). */
export const useLongTrend = (refTs?: number): LongTrend | undefined =>
  useLiveQuery(() => analysisClient.getLongTrend(refTs), [refTs]);

/** e1RM per session for an exercise, oldest first. */
export const useE1rmHistory = (exerciseId: string | undefined): E1rmPoint[] | undefined =>
  useLiveQuery(
    async () => (exerciseId ? await analysisClient.getE1rmHistory(exerciseId) : []),
    [exerciseId],
  );

/** Phase 4: per-exercise deload hint (`null` when none). */
export const useExerciseDeloadHint = (exerciseId: string): ExerciseDeloadHint | null | undefined =>
  useLiveQuery(() => analysisClient.getExerciseDeloadHint(exerciseId), [exerciseId]);
