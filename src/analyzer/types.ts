/** Shared analyzer types. Pure data: no React or Dexie. */
import type { Exercise, ExerciseMuscle, MuscleId } from '@/data';
import type { Session, SessionExercise, SetRow } from '@/db/types';
import type { VolumeTarget } from '@/config/training';

/** 0 = Sunday, 1 = Monday ... 6 = Saturday (same as Date#getDay). */
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Plain snapshot of user data the engines work on. */
export interface TrainingData {
  sessions: Session[];
  sessionExercises: SessionExercise[];
  sets: SetRow[];
  exercises: Exercise[];
  exerciseMuscles: ExerciseMuscle[];
}

export interface WeekWindow {
  /** Local midnight of the first day, epoch ms (inclusive). */
  start: number;
  /** Local midnight of the next week's first day, epoch ms (exclusive). */
  end: number;
}

export type MuscleStatus = 'none' | 'below' | 'building' | 'optimal' | 'high' | 'over';

export interface MuscleContribution {
  exerciseId: string;
  /** Working sets of this exercise counted this week. */
  sets: number;
  /** sets x muscle weight: this exercise's share of the muscle's volume. */
  weightedSets: number;
}

export interface MuscleWeek {
  muscleId: MuscleId;
  /** Weighted hard sets (sum of exerciseMuscles.weight over counted sets). */
  sets: number;
  status: MuscleStatus;
  target: VolumeTarget;
  /** Sorted by weightedSets descending. */
  contributions: MuscleContribution[];
}

export interface WeekAnalysis {
  window: WeekWindow;
  muscles: Record<MuscleId, MuscleWeek>;
  /** Exercise ids with at least one counted set this week. */
  exercisesDone: string[];
}

export interface MuscleTrendPoint {
  window: WeekWindow;
  sets: number;
}

export interface AnalyzerResult {
  current: WeekAnalysis;
  /** Oldest first, `trendWeeks` previous weeks followed by the current week. */
  trend: Record<MuscleId, MuscleTrendPoint[]>;
}

export interface LoggedSet {
  weightKg?: number;
  reps: number;
  rir?: number;
}

export interface ExerciseSessionSets {
  sessionId: string;
  startedAt: number;
  /** Working sets (completed, not warm-up), in order. */
  sets: LoggedSet[];
}

export interface ExerciseStats {
  exerciseId: string;
  /** Highest estimated 1RM set, or highest reps when no e1RM applies. */
  bestSet?: LoggedSet;
  /** Epley e1RM in kg; undefined for bodyweight sets without added weight. */
  estimated1RmKg?: number;
  lastSession?: ExerciseSessionSets;
  /** All sessions with working sets, newest first. */
  history: ExerciseSessionSets[];
}

export type AnalyzerOptions = {
  weekStartsOn: WeekStartDay;
  /** Resolved per-muscle targets (defaults merged with user overrides). */
  targets: Record<MuscleId, VolumeTarget>;
  maxCountedRir: number;
  trendWeeks: number;
};
