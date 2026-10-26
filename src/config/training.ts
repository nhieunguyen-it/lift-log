/**
 * Every training threshold used by the analyzer and recommendation engines.
 * Components and engines must read thresholds from here, never hard-code them.
 */
import type { Equipment, MuscleId } from '@/data';

/** Weekly hard-set volume landmarks for one muscle. */
export interface VolumeTarget {
  /** Minimum effective volume: fewer weekly sets than this rarely drive growth. */
  mev: number;
  /** Maximum adaptive volume range [low, high]: where most people grow best. */
  mavLow: number;
  mavHigh: number;
  /** Maximum recoverable volume: above this, recovery likely suffers. */
  mrv: number;
}

export interface RepRange {
  min: number;
  max: number;
}

export type RepRangeCategory = 'compound' | 'bodyweight' | 'isolation';

/** Where the weight increment for an exercise comes from. */
export type LoadStepCategory = 'lowerBarbell' | 'upperBarbell' | 'dumbbell' | 'other';

export interface TrainingConfig {
  /** A set with a recorded RIR above this is too easy to count as a hard set. */
  maxCountedRir: number;
  /** Number of past weeks (before the selected one) returned for trends. */
  trendWeeks: number;
  targets: Record<MuscleId, VolumeTarget>;
  repRanges: Record<RepRangeCategory, RepRange>;
  /** Per-exercise rep range overrides, keyed by exercise id. */
  repRangeOverrides: Record<string, RepRange>;
  /** Target reps-in-reserve for working sets. */
  targetRir: RepRange;
  /** Weight increments in kg (dumbbell is per hand). */
  loadStepsKg: Record<LoadStepCategory, number>;
  /** Equivalent increments for lbs users, so suggestions land on real plates. */
  loadStepsLbs: Record<LoadStepCategory, number>;
  /** Consecutive sessions missing the bottom of the range before holding / deloading. */
  missesToHold: number;
  missesToDeload: number;
  /** Fractional weight reduction on deload (0.1 = -10%). */
  deloadFraction: number;
  alternatives: {
    weightSimilarity: number;
    weightForce: number;
    weightMechanic: number;
    weightEquipment: number;
    /** Subtracted when the candidate was already done this week. */
    penaltyDoneThisWeek: number;
    limit: number;
  };
  volumeSuggestions: {
    /** How many exercises to suggest for a muscle below MEV. */
    exercisesPerMuscle: number;
  };
  /** An active session older than this prompts finish/discard. */
  staleSessionMs: number;
  /** Phase 3: previous weeks shown in the long (Analyze) volume trend; 11 + current = 12. */
  longTrendWeeks: number;
  deload: {
    /** Sessions of one exercise considered by fatigue detection. */
    lookbackSessions: number;
    /** e1RM drop (fraction, 0.1 = 10%) from the window's peak to the latest session. */
    e1rmDropFraction: number;
    /** Minimum sessions before any signal fires. */
    minSessions: number;
    /** Average RIR drop (first vs last session of the window) that counts as "trending down". */
    rirDrop: number;
    /** Exercises that must be flagged before an overall deload is suggested. */
    exercisesForOverall: number;
    /** Deload week: fraction of normal working sets kept. */
    setsFraction: number;
    /** Deload week target RIR (easy). */
    targetRir: RepRange;
    /** A dismissed suggestion stays hidden this long. */
    dismissMs: number;
  };
  programs: {
    /** Default rep range shown for program exercises without an override. */
    defaultTargetSets: number;
  };
  backup: {
    pbkdf2Iterations: number;
  };
  charts: {
    /** Fewer sessions than this shows an empty state instead of a chart. */
    minSessions: number;
  };
}

/*
 * Default volume landmarks (weekly hard sets). These are starting heuristics in the
 * spirit of Renaissance Periodization volume landmarks (MEV/MAV/MRV) and the
 * ~10-20 sets/week per muscle research consensus, not prescriptions. Users can
 * override any muscle in Settings.
 */
const STANDARD: VolumeTarget = { mev: 8, mavLow: 12, mavHigh: 18, mrv: 22 };
/** Small delt heads recover fast and tolerate more volume. */
const DELTS: VolumeTarget = { mev: 6, mavLow: 12, mavHigh: 20, mrv: 26 };
/** Calves and core: lower entry point, moderate ceiling. */
const SMALL: VolumeTarget = { mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 };
/** Heavily trained indirectly by compounds; little direct work needed. */
const INDIRECT: VolumeTarget = { mev: 4, mavLow: 6, mavHigh: 12, mrv: 16 };

export const DEFAULT_TARGETS: Record<MuscleId, VolumeTarget> = {
  chest: STANDARD,
  front_delts: STANDARD,
  side_delts: DELTS,
  rear_delts: DELTS,
  lats: STANDARD,
  upper_back: STANDARD,
  lower_back: INDIRECT,
  biceps: STANDARD,
  triceps: STANDARD,
  forearms: INDIRECT,
  abs: SMALL,
  obliques: SMALL,
  glutes: STANDARD,
  quads: STANDARD,
  hamstrings: STANDARD,
  adductors: INDIRECT,
  calves: SMALL,
};

export const TRAINING: TrainingConfig = {
  maxCountedRir: 4,
  trendWeeks: 4,
  targets: DEFAULT_TARGETS,
  repRanges: {
    compound: { min: 5, max: 10 },
    bodyweight: { min: 8, max: 20 },
    isolation: { min: 10, max: 20 },
  },
  repRangeOverrides: {
    plank: { min: 1, max: 1 },
    'side-plank': { min: 1, max: 1 },
    deadlift: { min: 3, max: 8 },
    'power-clean': { min: 2, max: 5 },
    'farmers-walk': { min: 1, max: 1 },
  },
  targetRir: { min: 1, max: 3 },
  loadStepsKg: { lowerBarbell: 5, upperBarbell: 2.5, dumbbell: 1, other: 2.5 },
  loadStepsLbs: { lowerBarbell: 10, upperBarbell: 5, dumbbell: 2.5, other: 5 },
  missesToHold: 2,
  missesToDeload: 3,
  deloadFraction: 0.1,
  alternatives: {
    weightSimilarity: 0.6,
    weightForce: 0.2,
    weightMechanic: 0.1,
    weightEquipment: 0.1,
    penaltyDoneThisWeek: 0.15,
    limit: 5,
  },
  volumeSuggestions: { exercisesPerMuscle: 3 },
  staleSessionMs: 12 * 60 * 60 * 1000,
  longTrendWeeks: 11,
  deload: {
    lookbackSessions: 4,
    e1rmDropFraction: 0.05,
    minSessions: 3,
    rirDrop: 1,
    exercisesForOverall: 2,
    setsFraction: 0.5,
    targetRir: { min: 3, max: 4 },
    dismissMs: 7 * 24 * 60 * 60 * 1000,
  },
  programs: { defaultTargetSets: 3 },
  backup: { pbkdf2Iterations: 310_000 },
  charts: { minSessions: 2 },
};

/** Equipment treated as "barbell or machine" for load steps. */
export const BARBELL_LIKE: readonly Equipment[] = ['barbell', 'machine', 'cable'];
