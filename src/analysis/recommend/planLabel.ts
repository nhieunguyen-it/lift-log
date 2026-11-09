import type { WeightUnit } from '@/lib/units';
import { kgToDisplay } from '@/lib/weight';
import { SYSTEM_INFO } from '@/program/systems';
import type { TrainingSystem } from '@/program/types';
import type { PlannedSet } from './systems';

/** Single value if all are equal, otherwise `first→last`. */
const span = (values: number[]): string =>
  values.every((v) => v === values[0])
    ? String(values[0])
    : `${values[0]}→${values[values.length - 1]}`;

const monotone = (values: number[]): boolean =>
  values.every((v, i) => i === 0 || v >= values[i - 1]) ||
  values.every((v, i) => i === 0 || v <= values[i - 1]);

/**
 * One-line summary of a planned set list, e.g. "Pyramid ▲ · 60→70 kg × 15→6". The weight is
 * omitted when any set has none or the weights go up and down (no honest single range).
 */
export function planLabel(system: TrainingSystem, plan: PlannedSet[], unit: WeightUnit): string {
  const head = SYSTEM_INFO[system].short;
  if (plan.length === 0) return head;
  const reps = span(plan.map((p) => p.reps));
  const kg = plan.map((p) => p.weightKg);
  if (!kg.every((w): w is number => w !== undefined) || !monotone(kg)) {
    return `${head} · ${reps} reps`;
  }
  const weight = span(kg.map((w) => kgToDisplay(w, unit)));
  return `${head} · ${weight} ${unit} × ${reps}`;
}
