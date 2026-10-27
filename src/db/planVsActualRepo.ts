import { analyzeWeek, defaultAnalyzerOptions, weekWindow } from '@/analyzer';
import { comparePlanToActual } from '@/program/planVsActual';
import { planCheck } from '@/program/planCheck';
import { applyBlockWeek, blockWeekAt } from '@/program/block';
import type { PlanVsActual } from '@/program/types';
import { loadTrainingData } from './analysisRepo';
import { getActiveProgram, loadPlanData } from './programsRepo';
import {
  getProgramBlocks,
  getTargetOverrides,
  getWeekStartsOn,
  resolveTargets,
} from './settingsRepo';

export interface PlanVsActualView {
  programName: string;
  /** Block week compared against, when a block covers this week. */
  blockWeek: number | null;
  /** True while the week is still running: unfinished days are "not done yet". */
  inProgress: boolean;
  result: PlanVsActual;
}

/** Phase 4: the active program's plan (or its block week) vs. the week's log. Null without a program. */
export async function getPlanVsActual(
  refTs: number,
  now = Date.now(),
): Promise<PlanVsActualView | null> {
  const program = await getActiveProgram();
  if (!program) return null;
  const [data, plan, blocks, wso, overrides] = await Promise.all([
    loadTrainingData(),
    loadPlanData(),
    getProgramBlocks(),
    getWeekStartsOn(),
    getTargetOverrides(),
  ]);
  const win = weekWindow(refTs, wso);
  const block = blocks[program.id];
  const blockWeek = block ? blockWeekAt(block, win.start, wso) : null;
  const planned = block && blockWeek !== null ? applyBlockWeek(program, block, blockWeek) : program;
  const check = planCheck(planned, plan.exercises, plan.exerciseMuscles, plan.targets);
  const week = analyzeWeek(
    data,
    win,
    defaultAnalyzerOptions({ weekStartsOn: wso, targets: resolveTargets(overrides) }),
  );
  const sessions = data.sessions.filter((s) => s.programId === program.id);
  return {
    programName: program.name,
    blockWeek,
    inProgress: win.end > now,
    result: comparePlanToActual(check, week, program.days, sessions),
  };
}
