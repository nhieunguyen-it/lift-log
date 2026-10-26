import type { MuscleWeek } from '@/analyzer';
import { MUSCLES } from '@/data';
import { STATUS_ORDER } from './statusStyle';

export type SortKey = 'name' | 'sets' | 'status' | 'distance';

const NAME = new Map<string, string>(MUSCLES.map((m) => [m.id, m.name]));
export const muscleName = (id: string): string => NAME.get(id) ?? id;

/** How far a muscle is from its adaptive range (0 when inside it). */
export function distanceFromTarget(m: Pick<MuscleWeek, 'sets' | 'target'>): number {
  if (m.sets < m.target.mavLow) return m.target.mavLow - m.sets;
  if (m.sets > m.target.mavHigh) return m.sets - m.target.mavHigh;
  return 0;
}

export function sortMuscles(list: MuscleWeek[], key: SortKey): MuscleWeek[] {
  const byName = (a: MuscleWeek, b: MuscleWeek) =>
    muscleName(a.muscleId).localeCompare(muscleName(b.muscleId));
  const cmp: Record<SortKey, (a: MuscleWeek, b: MuscleWeek) => number> = {
    name: byName,
    sets: (a, b) => b.sets - a.sets || byName(a, b),
    status: (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || byName(a, b),
    distance: (a, b) => distanceFromTarget(b) - distanceFromTarget(a) || byName(a, b),
  };
  return [...list].sort(cmp[key]);
}

/** Weighted sets with at most one decimal. */
export const fmtSets = (n: number): string => String(Math.round(n * 10) / 10);
