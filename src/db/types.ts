import type { WeightUnit } from '@/lib/units';

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
