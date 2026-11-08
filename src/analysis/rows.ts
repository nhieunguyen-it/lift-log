export interface Session {
  id: string;
  startedAt: number;
  finishedAt?: number;
  notes?: string;
  /** Phase 4: set when started from a program day (no index, so no schema bump). */
  programId?: string;
  programDayId?: string;
  /** Phase 4: block week (1-based) the day was started in, if a block was running. */
  blockWeek?: number;
  /** Sum of all closed pauses, in ms. */
  pausedMs?: number;
  /** Set while the session is paused: when the current pause began. */
  pausedAt?: number;
}

export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  /** Snapshot of the program exercise note when started from a program day. */
  note?: string;
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

export const CARDIO_INTENSITIES = ['relaxed', 'moderate', 'hard'] as const;
export type CardioIntensity = (typeof CARDIO_INTENSITIES)[number];

/** One timed cardio block inside a session exercise. */
export interface CardioEntry {
  id: string;
  sessionExerciseId: string;
  order: number;
  durationSec: number;
  intensity: CardioIntensity;
  completedAt?: number;
}
