import { useLiveQuery } from 'dexie-react-hooks';
import type { WeightUnit } from '@/lib/units';
import {
  getExerciseWithMuscles,
  listExercisesWithMuscles,
  listMuscles,
  recentExerciseIds,
} from './exercisesRepo';
import { getActiveSession, getSessionDetail, listHistory } from './sessionsRepo';
import { getAlternatives, getAnalysis, getExerciseInsight } from './analysisRepo';
import { getEquipment, getTargetOverrides, getUnit, getWeekStartsOn } from './settingsRepo';

/** All hooks return `undefined` while loading. */
export const useUnit = (): WeightUnit | undefined => useLiveQuery(() => getUnit(), []);
export const useActiveSession = () =>
  useLiveQuery(async () => (await getActiveSession()) ?? null, []);
export const useSessionDetail = (id: string | undefined) =>
  useLiveQuery(async () => (id ? ((await getSessionDetail(id)) ?? null) : null), [id]);
export const useHistory = () => useLiveQuery(() => listHistory(), []);
export const useExercisesWithMuscles = () => useLiveQuery(() => listExercisesWithMuscles(), []);
export const useMuscles = () => useLiveQuery(() => listMuscles(), []);
export const useRecentExerciseIds = () => useLiveQuery(() => recentExerciseIds(), []);
export const useExerciseDetail = (id: string | undefined) =>
  useLiveQuery(async () => (id ? ((await getExerciseWithMuscles(id)) ?? null) : null), [id]);

// Phase 2: analyzer / recommendations / settings.
export const useAnalysis = (refTs: number) => useLiveQuery(() => getAnalysis(refTs), [refTs]);
export const useExerciseInsight = (exerciseId: string | undefined, excludeSessionId?: string) =>
  useLiveQuery(
    async () => (exerciseId ? await getExerciseInsight(exerciseId, excludeSessionId) : null),
    [exerciseId, excludeSessionId],
  );
export const useAlternatives = (exerciseId: string | undefined) =>
  useLiveQuery(async () => (exerciseId ? await getAlternatives(exerciseId) : null), [exerciseId]);
export const useWeekStartsOn = () => useLiveQuery(() => getWeekStartsOn(), []);
export const useTargetOverrides = () => useLiveQuery(() => getTargetOverrides(), []);
export const useEquipment = () => useLiveQuery(() => getEquipment(), []);

// Phase 3 hooks live next to their repos; re-exported so UI imports one place.
export * from './programHooks';
export * from './progressHooks';
export * from './customHooks';
export { useAnalyzeView, useAnalyzeGrouping, setAnalyzeGrouping } from './analyzeHooks';
export type { AnalyzeView, AnalyzeGrouping } from './analyzeHooks';
export { useBlockView } from './blockHooks';
