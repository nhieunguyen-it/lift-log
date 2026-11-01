import type { Equipment, MuscleId } from '@/data';
import type { MergedExercise } from '@/data/merged';
import type { VolumeTarget } from '@/config/training';
import type { WeightUnit } from '@/lib/units';
import type { Program, ProgramBlock } from '@/program/types';
import type {
  AnalyzerResult,
  ExerciseStats,
  MuscleTrendPoint,
  TrainingData,
  WeekStartDay,
  WeekSummary,
} from './engine';
import type { ProgressionTarget, VolumeSuggestion } from './recommend';

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

export interface AnalysisView {
  result: AnalyzerResult;
  suggestions: VolumeSuggestion[];
  /** True when the user has no sessions at all. */
  empty: boolean;
}

export interface AnalyzeView extends AnalysisView {
  summary: WeekSummary;
}

export interface ExerciseInsight {
  stats: ExerciseStats;
  target: ProgressionTarget;
}

/** One exercise flagged by deload detection while there is no overall signal. */
export interface ExerciseDeloadHint {
  exerciseId: string;
  /** Dismissal key in the shared deload-dismissal storage. */
  key: string;
  /** e.g. "e1RM down 6% over 4 sessions". */
  detail: string;
}

export interface LongTrend {
  /** Oldest first: `longTrendWeeks` previous weeks then the current week. */
  trend: Record<MuscleId, MuscleTrendPoint[]>;
  targets: Record<MuscleId, VolumeTarget>;
}
