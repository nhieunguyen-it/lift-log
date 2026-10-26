import { useLiveQuery } from 'dexie-react-hooks';
import { planCheck } from '@/program/planCheck';
import type { PlanCheck, Program } from '@/program/types';
import {
  getActiveProgram,
  getProgram,
  getProgramAlternatives,
  listPrograms,
  loadPlanData,
} from './programsRepo';
import type { PlanData } from './programsRepo';

/** All hooks return `undefined` while loading. */

/** Built-in templates first, then user programs (newest edit first). */
export const usePrograms = (): Program[] | undefined => useLiveQuery(() => listPrograms(), []);

/** `null` when not found. */
export const useProgram = (id: string | undefined): Program | null | undefined =>
  useLiveQuery(async () => (id ? ((await getProgram(id)) ?? null) : null), [id]);

/** `null` when no program is active. */
export const useActiveProgram = (): Program | null | undefined =>
  useLiveQuery(() => getActiveProgram(), []);

/** Exercises (seed + custom) and resolved volume targets used by the plan check. */
export const usePlanData = (): PlanData | undefined => useLiveQuery(() => loadPlanData(), []);

/** Live projected weekly volume for a stored program (`null` if not found). */
export const usePlanCheck = (programId: string | undefined): PlanCheck | null | undefined =>
  useLiveQuery(async () => {
    if (!programId) return null;
    const [program, data] = await Promise.all([getProgram(programId), loadPlanData()]);
    return program ? planCheck(program, data.exercises, data.exerciseMuscles, data.targets) : null;
  }, [programId]);

export const useProgramAlternatives = (exerciseId: string | undefined) =>
  useLiveQuery(
    async () => (exerciseId ? await getProgramAlternatives(exerciseId) : null),
    [exerciseId],
  );
