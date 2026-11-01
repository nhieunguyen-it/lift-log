import type { WeightUnit } from '@/lib/units';
import type { MergedExercise } from '@/data/merged';
import type { ExerciseMuscle } from '@/data';
import type { Program } from '@/program/types';

/** Phase 3 (schema v2): user-created exercise; id is `custom-<uuid>`. */
export type CustomExerciseRow = MergedExercise & {
  isCustom: true;
  createdAt: number;
  updatedAt: number;
};
export type CustomExerciseMuscleRow = ExerciseMuscle;
export type ProgramRow = Program;

export type {
  Session,
  SessionExercise,
  SetRow,
  CardioIntensity,
  CardioEntry,
} from '@/analysis/rows';
export { CARDIO_INTENSITIES } from '@/analysis/rows';

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface Settings {
  unit: WeightUnit;
  seedVersion: number;
}

export interface SessionSummary {
  durationMs: number;
  exerciseCount: number;
  workingSets: number;
  volumeKg: number;
  /** Counted cardio minutes (completed entries with a duration). */
  cardioMinutes: number;
}
