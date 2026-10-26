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

export interface Session {
  id: string;
  startedAt: number;
  finishedAt?: number;
  notes?: string;
}

export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
}

export interface SetRow {
  id: string;
  sessionExerciseId: string;
  order: number;
  /** Always stored in kg. For bodyweight exercises this is added weight. */
  weightKg?: number;
  reps: number;
  rir?: number;
  isWarmup: boolean;
  completedAt?: number;
}

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
}
