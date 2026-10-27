/** Phase 4: program blocks (mesocycles). Pure: no React or Dexie. */
import type { ExerciseMuscle, MuscleId } from '@/data';
import { MUSCLE_IDS } from '@/data';
import type { Exercise } from '@/data';
import { TRAINING } from '@/config/training';
import type { VolumeTarget } from '@/config/training';
import type { WeekStartDay } from '@/analyzer/types';
import { weekWindow } from '@/analyzer/week';
import { planCheck } from './planCheck';
import type {
  BlockMrvWarning,
  BlockProjection,
  BlockWeek,
  BlockWeekExercise,
  Program,
  ProgramBlock,
} from './types';

export interface BlockPlanData {
  exercises: Pick<Exercise, 'id'>[];
  exerciseMuscles: ExerciseMuscle[];
  targets: Record<MuscleId, VolumeTarget>;
}

export function clampWeeks(weeks: number): number {
  const { minWeeks, maxWeeks } = TRAINING.blocks;
  return Math.min(maxWeeks, Math.max(minWeeks, Math.round(weeks)));
}

/** Creates a block whose week 1 starts on the week-start day containing `startTs`. */
export function newBlock(
  startTs: number,
  weekStartsOn: WeekStartDay,
  rampExerciseIds: string[],
  weeks: number = TRAINING.blocks.defaultWeeks,
): ProgramBlock {
  return {
    startDate: weekWindow(startTs, weekStartsOn).start,
    weeks: clampWeeks(weeks),
    ramp: { ...TRAINING.blocks.ramp },
    rampExerciseIds: [...new Set(rampExerciseIds)],
  };
}

/** Default ramped exercises: the first exercise of every day. */
export function defaultRampExerciseIds(program: Program): string[] {
  return [
    ...new Set(program.days.flatMap((d) => (d.exercises[0] ? [d.exercises[0].exerciseId] : []))),
  ];
}

/** 1-based block week containing `ts`, or null before the start or after the last week. */
export function blockWeekAt(
  block: ProgramBlock,
  ts: number,
  weekStartsOn: WeekStartDay,
): number | null {
  const cur = weekWindow(ts, weekStartsOn).start;
  if (cur < block.startDate) return null;
  // Round to absorb DST shifts (23/25h days) in the local-midnight difference.
  const week = Math.round((cur - block.startDate) / (7 * 86_400_000)) + 1;
  return week >= 1 && week <= block.weeks ? week : null;
}

export function isDeloadWeek(block: ProgramBlock, week: number): boolean {
  return week === block.weeks;
}

/** Sets for one exercise in a given block week. */
export function weekSets(
  block: ProgramBlock,
  week: number,
  exerciseId: string,
  baseSets: number,
): number {
  if (isDeloadWeek(block, week)) {
    return Math.max(1, Math.round(baseSets * TRAINING.deload.setsFraction));
  }
  if (!block.rampExerciseIds.includes(exerciseId)) return baseSets;
  const extra = Math.min(block.ramp.maxExtraSets, (week - 1) * block.ramp.setsPerWeek);
  return baseSets + extra;
}

/** The program with one block week's set counts applied (a copy). */
export function applyBlockWeek(program: Program, block: ProgramBlock, week: number): Program {
  return {
    ...program,
    days: program.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => ({
        ...e,
        targetSets: weekSets(block, week, e.exerciseId, e.targetSets),
      })),
    })),
  };
}

export function projectBlock(
  program: Program,
  block: ProgramBlock,
  data: BlockPlanData,
): BlockProjection {
  const weeks: BlockWeek[] = [];
  const mrvWarnings: BlockMrvWarning[] = [];
  for (let w = 1; w <= block.weeks; w++) {
    const applied = applyBlockWeek(program, block, w);
    const exercises: BlockWeekExercise[] = applied.days.flatMap((d) =>
      d.exercises.map((e, index) => ({
        dayId: d.id,
        index,
        exerciseId: e.exerciseId,
        sets: e.targetSets,
      })),
    );
    const check = planCheck(applied, data.exercises, data.exerciseMuscles, data.targets);
    const deload = isDeloadWeek(block, w);
    weeks.push({
      week: w,
      deload,
      targetRir: deload ? { ...TRAINING.deload.targetRir } : undefined,
      exercises,
      planCheck: check,
    });
    for (const id of MUSCLE_IDS) {
      const m = check.muscles[id];
      if (m.sets > m.target.mrv) {
        mrvWarnings.push({ week: w, muscleId: id, sets: m.sets, mrv: m.target.mrv });
      }
    }
  }
  return { weeks, mrvWarnings };
}
