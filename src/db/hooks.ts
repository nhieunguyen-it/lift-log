import { useLiveQuery } from 'dexie-react-hooks';
import type { WeightUnit } from '@/lib/units';
import { listExercisesWithMuscles, listMuscles, recentExerciseIds } from './exercisesRepo';
import { getActiveSession, getSessionDetail, listHistory } from './sessionsRepo';
import { getUnit } from './settingsRepo';

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
