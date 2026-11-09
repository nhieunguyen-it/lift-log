/** System-aware set planner. Pure: no Dexie or React. */
import type { Exercise, MuscleId } from '@/data';
import { TRAINING } from '@/config/training';
import type { RepRange, TrainingConfig } from '@/config/training';
import { kgToLbs, lbsToKg } from '@/lib/units';
import type { WeightUnit } from '@/lib/units';
import { PITT_DEFAULT_RANGE } from '@/program/systems';
import type { TrainingSystem } from '@/program/types';
import { loadStepCategory, repRangeFor, loadable, stepped } from './progression';

export interface PlannedSet {
  weightKg?: number;
  reps: number;
}
export interface HistorySet {
  weightKg?: number;
  reps: number;
}

export function resolveRepRange(
  system: TrainingSystem,
  programRange: RepRange | undefined,
  exercise: Exercise,
  config: TrainingConfig = TRAINING,
): RepRange {
  if (programRange) return programRange;
  if (system === 'pitt_force') return PITT_DEFAULT_RANGE;
  return repRangeFor(exercise, config);
}

const descending = (r: RepRange, n: number, i: number) =>
  n <= 1 ? r.max : Math.round(r.max - ((r.max - r.min) * i) / (n - 1));
const ascending = (r: RepRange, n: number, i: number) =>
  n <= 1 ? r.min : Math.round(r.min + ((r.max - r.min) * i) / (n - 1));

const allTop = (range: RepRange, sets: number, history: HistorySet[]) =>
  history.length >= sets && history.length > 0 && history.every((s) => s.reps >= range.max);

export function planReps(
  system: TrainingSystem,
  range: RepRange,
  sets: number,
  history: HistorySet[],
): number[] {
  const n = Math.max(0, sets);
  const idx = Array.from({ length: n }, (_, i) => i);
  switch (system) {
    case 'pyramid_up':
      return idx.map((i) => descending(range, n, i));
    case 'pyramid_down':
      return idx.map((i) => ascending(range, n, i));
    case 'pitt_force':
      return idx.map(() => range.max);
    case 'progression': {
      let r = range.min;
      if (range.min !== range.max && history.length > 0 && !allTop(range, n, history)) {
        r = Math.min(range.max, Math.min(...history.map((s) => s.reps)) + 1);
      } else if (range.min === range.max) {
        r = range.max;
      }
      return idx.map(() => r);
    }
  }
}

export function planSets(args: {
  system: TrainingSystem;
  repRange: RepRange;
  sets: number;
  history: HistorySet[];
  exercise: Exercise;
  primaryMuscleIds: MuscleId[];
  unit: WeightUnit;
  deloadWeek?: boolean;
  config?: TrainingConfig;
}): PlannedSet[] {
  const { system, repRange, sets, history, exercise, unit } = args;
  const config = args.config ?? TRAINING;
  const reps = planReps(system, repRange, sets, history);
  const maxWeight = Math.max(0, ...history.map((s) => s.weightKg ?? 0));
  const hasLoad = maxWeight > 0;
  if (history.length === 0 || (exercise.isBodyweight && !hasLoad)) {
    return reps.map((r) => ({ reps: r }));
  }
  const category = loadStepCategory(exercise, args.primaryMuscleIds);
  const up = (kg: number) =>
    args.deloadWeek ? loadable(kg, unit).weightKg : stepped(kg, category, unit, config).weightKg;
  const down = (kg: number) => {
    if (unit === 'kg') {
      return loadable(Math.max(0, kg - config.loadStepsKg[category]), unit).weightKg;
    }
    const lbs = Math.max(0, kgToLbs(kg) - config.loadStepsLbs[category]);
    return loadable(lbsToKg(lbs), unit).weightKg;
  };

  if (system === 'progression' || system === 'pitt_force') {
    if (!hasLoad) return reps.map((r) => ({ reps: r }));
    const w = allTop(repRange, sets, history) ? up(maxWeight) : loadable(maxWeight, unit).weightKg;
    return reps.map((r) => ({ weightKg: w, reps: r }));
  }

  const out: PlannedSet[] = [];
  let prev: number | undefined;
  reps.forEach((r, i) => {
    const h = history[i];
    let w: number | undefined;
    if (h && h.weightKg !== undefined) {
      w = h.reps >= r ? up(h.weightKg) : loadable(h.weightKg, unit).weightKg;
    } else if (prev !== undefined) {
      w = system === 'pyramid_up' ? up(prev) : down(prev);
    }
    prev = w;
    out.push(w === undefined ? { reps: r } : { weightKg: w, reps: r });
  });
  return out;
}
