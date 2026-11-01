import { applyBlockWeek, blockWeekAt } from '@/program/block';
import { planCheck } from '@/program/planCheck';
import { comparePlanToActual } from '@/program/planVsActual';
import { analyzeWeek, defaultAnalyzerOptions, weekWindow } from '../engine';
import type { AnalysisInput, PlanVsActualView } from '../types';

/**
 * The active program's plan (or its block week) vs. the week containing `refTs`.
 * Null without an active program. Tombstoned customs are left out of the plan.
 */
export function planVsActual(input: AnalysisInput, refTs: number): PlanVsActualView | null {
  const program = input.program.active;
  if (!program) return null;
  const { data, settings } = input;
  const wso = settings.weekStartsOn;
  const planExercises = data.exercises.filter((e) => e.deletedAt === undefined);
  const ids = new Set(planExercises.map((e) => e.id));
  const planMuscles = data.exerciseMuscles.filter((m) => ids.has(m.exerciseId));
  const win = weekWindow(refTs, wso);
  const block = input.program.blocks[program.id];
  const blockWeek = block ? blockWeekAt(block, win.start, wso) : null;
  const planned = block && blockWeek !== null ? applyBlockWeek(program, block, blockWeek) : program;
  const check = planCheck(planned, planExercises, planMuscles, settings.targets);
  const week = analyzeWeek(
    data,
    win,
    defaultAnalyzerOptions({ weekStartsOn: wso, targets: settings.targets }),
  );
  const sessions = data.sessions.filter((s) => s.programId === program.id);
  return {
    programName: program.name,
    blockWeek,
    inProgress: win.end > input.now,
    result: comparePlanToActual(check, week, program.days, sessions),
  };
}
