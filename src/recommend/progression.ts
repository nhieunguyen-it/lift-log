import type { Exercise, MuscleId } from '@/data';
import { BARBELL_LIKE, TRAINING } from '@/config/training';
import type { LoadStepCategory, RepRange, TrainingConfig } from '@/config/training';
import type { ExerciseSessionSets } from '@/analyzer/types';
import { kgToLbs, lbsToKg, roundKg, roundLbs } from '@/lib/units';
import type { WeightUnit } from '@/lib/units';
import { kgToDisplay } from '@/lib/weight';
import type { ProgressionTarget } from './types';
import type { MergedExercise } from '@/data/merged';
import { nextVariantId } from '@/data/variantChains';

const LOWER_BODY_MUSCLES: readonly MuscleId[] = [
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
];

export function repRangeFor(ex: Exercise, config: TrainingConfig = TRAINING): RepRange {
  const own = (ex as MergedExercise).repRange;
  if (own) return own;
  const override = config.repRangeOverrides[ex.id];
  if (override) return override;
  if (ex.isBodyweight) return config.repRanges.bodyweight;
  return ex.mechanic === 'compound' ? config.repRanges.compound : config.repRanges.isolation;
}

/** `primaryMuscleIds`: the muscles with weight 1.0 for this exercise. */
export function loadStepCategory(ex: Exercise, primaryMuscleIds: MuscleId[]): LoadStepCategory {
  if (ex.equipment === 'dumbbell' || ex.equipment === 'kettlebell') return 'dumbbell';
  if (BARBELL_LIKE.includes(ex.equipment)) {
    const lower =
      ex.force === 'legs' || primaryMuscleIds.some((m) => LOWER_BODY_MUSCLES.includes(m));
    return lower ? 'lowerBarbell' : 'upperBarbell';
  }
  return 'other';
}

/** Shift a kg weight by `delta` (fraction or step) in the user's unit, landing on a loadable value. */
function loadable(kg: number, unit: WeightUnit): { weightKg: number; displayWeight: number } {
  const displayWeight = kgToDisplay(kg, unit);
  return { weightKg: unit === 'kg' ? displayWeight : lbsToKg(displayWeight), displayWeight };
}

function stepped(
  kg: number,
  category: LoadStepCategory,
  unit: WeightUnit,
  config: TrainingConfig,
): { weightKg: number; displayWeight: number } {
  if (unit === 'kg') {
    const d = roundKg(kg + config.loadStepsKg[category]);
    return { weightKg: d, displayWeight: d };
  }
  const d = roundLbs(kgToLbs(kg) + config.loadStepsLbs[category]);
  return { weightKg: lbsToKg(d), displayWeight: d };
}

function rangeText(r: RepRange): string {
  return r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
}

/** Consecutive newest sessions (newest first) in which any set missed the bottom of the range. */
export function countMisses(history: ExerciseSessionSets[], range: RepRange): number {
  let misses = 0;
  for (const session of history) {
    if (session.sets.some((s) => s.reps < range.min)) misses++;
    else break;
  }
  return misses;
}

export function nextTarget(args: {
  exercise: Exercise;
  primaryMuscleIds: MuscleId[];
  history: ExerciseSessionSets[];
  unit: WeightUnit;
  config?: TrainingConfig;
  /** Used to name the next variant in the label; falls back to the id. */
  exercises?: readonly Pick<Exercise, 'id' | 'name'>[];
}): ProgressionTarget {
  const { exercise, primaryMuscleIds, history, unit } = args;
  const config = args.config ?? TRAINING;
  const range = repRangeFor(exercise, config);
  const base = {
    exerciseId: exercise.id,
    unit,
    repRange: range,
    targetRir: config.targetRir,
  };
  const repsText = rangeText(range);

  const build = (
    action: ProgressionTarget['action'],
    targetReps: number,
    w: { weightKg: number; displayWeight: number } | undefined,
    reason: string,
    labelOverride?: string,
  ): ProgressionTarget => ({
    ...base,
    action,
    targetReps,
    ...(w ? { weightKg: w.weightKg, displayWeight: w.displayWeight } : {}),
    label:
      labelOverride ??
      (w ? `Target: ${w.displayWeight} ${unit} × ${repsText}` : `Target: ${repsText} reps`),
    reason,
  });

  const last = history[0];
  if (!last || last.sets.length === 0) {
    return build(
      'start',
      range.min,
      undefined,
      'No history yet: pick a weight you can lift for the range.',
    );
  }

  const maxWeight = Math.max(0, ...last.sets.map((s) => s.weightKg ?? 0));
  const hasLoad = maxWeight > 0;
  const pureBodyweight = exercise.isBodyweight && !hasLoad;
  const current = hasLoad ? loadable(maxWeight, unit) : undefined;
  const category = loadStepCategory(exercise, primaryMuscleIds);

  const topHit = last.sets.every(
    (s) => s.reps >= range.max && (s.rir === undefined || s.rir <= config.targetRir.max),
  );
  if (topHit) {
    const reason = `All sets hit ${range.max} reps at RIR ≤ ${config.targetRir.max}.`;
    if (pureBodyweight) {
      const nextId = nextVariantId(exercise.id);
      const nextName = nextId
        ? (args.exercises?.find((e) => e.id === nextId)?.name ?? nextId)
        : undefined;
      const t = build(
        'add_load_or_variant',
        range.min,
        undefined,
        reason,
        nextName
          ? `Next: ${nextName} (${repsText} reps)`
          : `Add weight or try a harder variation (${repsText} reps)`,
      );
      return nextId ? { ...t, nextVariantId: nextId } : t;
    }
    return build('increase_weight', range.min, stepped(maxWeight, category, unit, config), reason);
  }

  const misses = countMisses(history, range);
  if (misses >= config.missesToDeload) {
    const w = hasLoad ? loadable(maxWeight * (1 - config.deloadFraction), unit) : undefined;
    return build(
      'deload',
      range.min,
      w,
      `Missed ${range.min} reps ${misses} sessions in a row: deload.`,
    );
  }
  if (misses >= config.missesToHold) {
    return build(
      'hold',
      range.min,
      current,
      `Missed ${range.min} reps ${misses} sessions in a row: hold the weight.`,
    );
  }

  const minReps = Math.min(...last.sets.map((s) => s.reps));
  const targetReps = Math.min(range.max, minReps + 1);
  return build(
    pureBodyweight ? 'add_reps_bodyweight' : 'add_rep',
    targetReps,
    current,
    `Build reps toward ${range.max} before adding weight.`,
    current
      ? `Target: ${current.displayWeight} ${unit} × ${targetReps}–${range.max}`
      : `Target: ${targetReps}–${range.max} reps`,
  );
}
