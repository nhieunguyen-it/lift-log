/** Shared recommendation types. Pure data: no React or Dexie. */
import type { Equipment, MuscleId } from '@/data';
import type { RepRange } from '@/config/training';
import type { WeightUnit } from '@/lib/units';

export type ProgressionAction =
  | 'start' // no history: pick a weight you can do for the range
  | 'increase_weight'
  | 'add_rep'
  | 'add_reps_bodyweight'
  | 'add_load_or_variant' // bodyweight at top of range
  | 'hold'
  | 'deload';

export interface ProgressionTarget {
  exerciseId: string;
  action: ProgressionAction;
  /** Suggested load in kg (added weight for bodyweight); undefined = bodyweight only / unknown. */
  weightKg?: number;
  /** Weight in the user's unit, already rounded to a loadable value. */
  displayWeight?: number;
  unit: WeightUnit;
  repRange: RepRange;
  /** Suggested reps for the next set (e.g. last reps + 1); falls back to repRange.min. */
  targetReps: number;
  targetRir: RepRange;
  /** Short human text, e.g. "Target: 82.5 kg × 6–10". */
  label: string;
  /** Optional one-line reason, e.g. "All sets hit 10 reps at RIR ≤ 3". */
  reason?: string;
  /** Bodyweight at top of range: the next-harder exercise in its variant chain, if any. */
  nextVariantId?: string;
}

export interface ExerciseSuggestion {
  exerciseId: string;
  /** Weight of the target muscle in this exercise (sets added per set done). */
  muscleWeight: number;
}

export type VolumeSuggestion =
  | {
      kind: 'add';
      muscleId: MuscleId;
      current: number;
      mev: number;
      /** Whole sets to add to reach MEV (ceil of the gap, at weight 1.0). */
      setsToAdd: number;
      exercises: ExerciseSuggestion[];
    }
  | {
      kind: 'over';
      muscleId: MuscleId;
      current: number;
      mrv: number;
    };

export interface AlternativeScore {
  exerciseId: string;
  score: number;
  similarity: number;
  sameForce: boolean;
  sameMechanic: boolean;
  doneThisWeek: boolean;
}

export interface AlternativesInput {
  exerciseId: string;
  availableEquipment: readonly Equipment[];
  exercisesDoneThisWeek: readonly string[];
}

/** Phase 3: fatigue / deload detection. */
export type DeloadReason = 'e1rm_drop' | 'rir_and_reps_down' | 'repeated_misses';

export interface ExerciseFatigue {
  exerciseId: string;
  reasons: DeloadReason[];
  /** Human one-liner, e.g. "e1RM down 7% over 4 sessions". */
  detail: string;
}

export interface DeloadSignal {
  /** True when enough exercises are flagged to suggest a full deload week. */
  overall: boolean;
  exercises: ExerciseFatigue[];
  /** Deload prescription: fraction of sets to keep and an easy RIR. */
  setsFraction: number;
  targetRir: RepRange;
  /** Stable key for dismissal: sorted flagged ids + latest session id. */
  key: string;
}
