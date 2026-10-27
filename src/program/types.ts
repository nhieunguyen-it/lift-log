/** Program (weekly plan) types. Pure data: no React or Dexie. */
import type { MuscleId } from '@/data';
import type { BlockRamp, RepRange, VolumeTarget } from '@/config/training';
import type { MuscleStatus } from '@/analyzer/types';

export interface ProgramExercise {
  exerciseId: string;
  targetSets: number;
  /** Overrides the exercise's default rep range for this program. */
  repRange?: RepRange;
}

export interface ProgramDay {
  id: string;
  name: string;
  exercises: ProgramExercise[];
}

export interface Program {
  /** Built-in templates use `builtin-<slug>`; user programs a uuid. */
  id: string;
  name: string;
  /** Built-ins are read-only; duplicate before editing. */
  builtIn: boolean;
  days: ProgramDay[];
  createdAt: number;
  updatedAt: number;
}

export interface PlanMuscle {
  muscleId: MuscleId;
  /** Projected weighted weekly sets if every day is done once. */
  sets: number;
  status: MuscleStatus;
  target: VolumeTarget;
  /** Projected weighted sets per exercise id. */
  contributions: { exerciseId: string; weightedSets: number }[];
}

export interface PlanWarning {
  muscleId: MuscleId;
  kind: 'below_mev' | 'above_mrv';
  sets: number;
  threshold: number;
}

export interface PlanCheck {
  muscles: Record<MuscleId, PlanMuscle>;
  warnings: PlanWarning[];
  /** Exercise ids not found in the exercise list (deleted customs etc.). */
  unknownExerciseIds: string[];
}

/**
 * Phase 4: a program run as a block of N weeks. Stored per program id in settings
 * (`programBlocks`) so built-in templates can run blocks too.
 */
export interface ProgramBlock {
  /** Local midnight of the first day of week 1 (a week-start day). */
  startDate: number;
  /** Total weeks, final week is the planned deload. */
  weeks: number;
  ramp: BlockRamp;
  /** Exercise ids whose sets ramp; others stay at their base targetSets. */
  rampExerciseIds: string[];
}

export interface BlockWeekExercise {
  dayId: string;
  /** Position in the day's exercise list. */
  index: number;
  exerciseId: string;
  sets: number;
}

export interface BlockWeek {
  /** 1-based. */
  week: number;
  deload: boolean;
  /** Easy RIR on the deload week; undefined otherwise. */
  targetRir?: RepRange;
  exercises: BlockWeekExercise[];
  planCheck: PlanCheck;
}

export interface BlockMrvWarning {
  week: number;
  muscleId: MuscleId;
  sets: number;
  mrv: number;
}

export interface BlockProjection {
  weeks: BlockWeek[];
  /** Every (week, muscle) whose projected sets exceed MRV. */
  mrvWarnings: BlockMrvWarning[];
}

/** Phase 4: plan vs. actual for one week. */
export interface PlanVsActualMuscle {
  muscleId: MuscleId;
  planned: number;
  actual: number;
  /** actual - planned (negative = fell short). */
  gap: number;
}

export interface PlanVsActualDay {
  dayId: string;
  name: string;
  done: boolean;
}

export interface PlanVsActual {
  /** Muscles with planned > 0 or actual > 0; most negative gap first. */
  muscles: PlanVsActualMuscle[];
  days: PlanVsActualDay[];
  daysDone: number;
  daysSkipped: number;
}
