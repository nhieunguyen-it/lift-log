import type { Equipment, MuscleId } from '@/data';
import type { MergedExercise } from '@/data/merged';
import type { VolumeTarget } from '@/config/training';
import type { WeightUnit } from '@/lib/units';
import type { Program, ProgramBlock } from '@/program/types';
import type { TrainingData, WeekStartDay } from './engine';

export * from './rows';

export interface AnalysisSettings {
  weekStartsOn: WeekStartDay;
  targets: Record<MuscleId, VolumeTarget>;
  equipment: Equipment[];
  unit: WeightUnit;
}

/** One serializable snapshot of everything the analysis queries read. */
export interface AnalysisInput {
  data: Omit<TrainingData, 'exercises'> & { exercises: MergedExercise[] };
  settings: AnalysisSettings;
  program: { active: Program | null; blocks: Record<string, ProgramBlock> };
  deloadDismissals: Record<string, number>;
  now: number;
}
