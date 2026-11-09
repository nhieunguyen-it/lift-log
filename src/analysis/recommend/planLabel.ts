import type { WeightUnit } from '@/lib/units';
import { kgToDisplay } from '@/lib/weight';
import { SYSTEM_INFO } from '@/program/systems';
import type { TrainingSystem } from '@/program/types';
import type { PlannedSet } from './systems';

const span = (first: number, last: number): string =>
  first === last ? String(first) : `${first}→${last}`;

/** One-line summary of a planned set list, e.g. "Pyramid ▲ · 60→70 kg × 15→6". */
export function planLabel(system: TrainingSystem, plan: PlannedSet[], unit: WeightUnit): string {
  const head = SYSTEM_INFO[system].short;
  if (plan.length === 0) return head;
  const first = plan[0];
  const last = plan[plan.length - 1];
  const reps = span(first.reps, last.reps);
  if (first.weightKg === undefined || last.weightKg === undefined) {
    return `${head} · ${reps} reps`;
  }
  const weight = span(kgToDisplay(first.weightKg, unit), kgToDisplay(last.weightKg, unit));
  return `${head} · ${weight} ${unit} × ${reps}`;
}
