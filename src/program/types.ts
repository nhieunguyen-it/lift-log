/** Program (weekly plan) types. Pure data: no React or Dexie. */
import type { MuscleId } from '@/data';
import type { RepRange, VolumeTarget } from '@/config/training';
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
