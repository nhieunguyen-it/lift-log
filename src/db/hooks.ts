import { useLiveQuery } from 'dexie-react-hooks';
import type { WeightUnit } from '@/lib/units';
import {
  getExerciseWithMuscles,
  listExercisesWithMuscles,
  listMuscles,
  recentExerciseIds,
} from './exercisesRepo';
import { getActiveSession, getSessionDetail, listHistory } from './sessionsRepo';
import { deloadWeekForSession, planForSessionExercise } from './plannedSets';
import type { PlannedSet } from '@/analysis/recommend';
import type { SessionExercise } from '@/analysis/rows';
import { analysisClient } from './localAnalysisClient';
import {
  getEquipment,
  getPittSettings,
  getTargetOverrides,
  getUnit,
  getWeekStartsOn,
  type PittSettings,
} from './settingsRepo';

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
export const useAnalysis = (refTs: number) =>
  useLiveQuery(() => analysisClient.getAnalysis(refTs), [refTs]);
export const useExerciseInsight = (exerciseId: string | undefined, excludeSessionId?: string) =>
  useLiveQuery(
    async () =>
      exerciseId ? await analysisClient.getExerciseInsight(exerciseId, excludeSessionId) : null,
    [exerciseId, excludeSessionId],
  );
/**
 * Planned working sets for a session exercise. `null` when it has no training-system snapshot
 * (ad-hoc exercise), `undefined` while loading.
 */
export const useSetPlan = (se: SessionExercise | undefined): PlannedSet[] | undefined | null =>
  useLiveQuery(async () => {
    if (!se) return null;
    if (se.system === undefined && se.mainFocus === undefined && se.repRange === undefined) {
      return null;
    }
    // Plans for the current row count, so adding rows reshapes pyramid reps (documented).
    return planForSessionExercise(se, { deloadWeek: await deloadWeekForSession(se.sessionId) });
  }, [
    se?.id,
    se?.sessionId,
    se?.exerciseId,
    se?.system,
    se?.mainFocus,
    se?.repRange?.min,
    se?.repRange?.max,
  ]);
export const useAlternatives = (exerciseId: string | undefined) =>
  useLiveQuery(
    async () => (exerciseId ? await analysisClient.getAlternatives(exerciseId) : null),
    [exerciseId],
  );
export const useWeekStartsOn = () => useLiveQuery(() => getWeekStartsOn(), []);
export const useTargetOverrides = () => useLiveQuery(() => getTargetOverrides(), []);
export const useEquipment = () => useLiveQuery(() => getEquipment(), []);
export const usePittSettings = (): PittSettings | undefined =>
  useLiveQuery(() => getPittSettings(), []);

// Phase 3 hooks live next to their repos; re-exported so UI imports one place.
export * from './programHooks';
export * from './progressHooks';
export * from './customHooks';
export { useAnalyzeView, useAnalyzeGrouping, setAnalyzeGrouping } from './analyzeHooks';
export type { AnalyzeView, AnalyzeGrouping } from './analyzeHooks';
export { useBlockView } from './blockHooks';
export { usePlanVsActual } from './planVsActualHooks';
export type { PlanVsActualView } from './planVsActualHooks';
export { useProfiles, useActiveProfileName } from './profileHooks';
export * from './cardioHooks';
