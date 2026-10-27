/** Pure view-model helpers for the Analyze page (no React, no Dexie). */
import type { MuscleContribution, MuscleStatus, MuscleWeek } from '@/analyzer';
import type { VolumeTarget } from '@/config/training';
import { MUSCLES } from '@/data';
import { fmtSets, muscleName, sortMuscles } from './muscleSort';
import type { SortKey } from './muscleSort';
import { STATUS_LABEL, STATUS_ORDER } from './statusStyle';

type MuscleGroup = (typeof MUSCLES)[number]['group'];

const clampPct = (n: number) => Math.min(100, Math.max(0, n));
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface RangeBarGeometry {
  /** Scale maximum in sets. */
  max: number;
  /** All values are percentages (0-100) of the bar width. */
  value: number;
  mev: number;
  mavLow: number;
  mavHigh: number;
  mrv: number;
  /** True when the value is beyond the scale and was clamped to the end. */
  overflow: boolean;
}

/** Geometry for a horizontal range bar; the scale ends at mrv x headroom. */
export function rangeBarGeometry(
  sets: number,
  target: VolumeTarget,
  headroom: number,
): RangeBarGeometry {
  const max = Math.max(1, target.mrv * Math.max(1, headroom));
  const pct = (v: number) => clampPct((v / max) * 100);
  return {
    max,
    value: pct(sets),
    mev: pct(target.mev),
    mavLow: pct(target.mavLow),
    mavHigh: pct(target.mavHigh),
    mrv: pct(target.mrv),
    overflow: sets > max,
  };
}

/** Screen-reader sentence for a muscle row, e.g. "Chest: 10 sets, building, MEV 8, MAV 12–18, MRV 22". */
export function muscleSrText(
  m: Pick<MuscleWeek, 'muscleId' | 'sets' | 'status' | 'target'>,
): string {
  const t = m.target;
  const unit = m.sets === 1 ? 'set' : 'sets';
  return `${muscleName(m.muscleId)}: ${fmtSets(m.sets)} ${unit}, ${STATUS_LABEL[m.status]}, MEV ${t.mev}, MAV ${t.mavLow}–${t.mavHigh}, MRV ${t.mrv}`;
}

export interface StatusSegment {
  status: MuscleStatus;
  count: number;
  /** Share of all muscles, 0-100. */
  pct: number;
}

/** Non-empty status segments in display order. */
export function statusSegments(counts: Record<MuscleStatus, number>): StatusSegment[] {
  const total = STATUS_ORDER.reduce((a, s) => a + counts[s], 0);
  return STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => ({
    status: s,
    count: counts[s],
    pct: total === 0 ? 0 : (counts[s] / total) * 100,
  }));
}

export function statusBarLabel(counts: Record<MuscleStatus, number>): string {
  const total = STATUS_ORDER.reduce((a, s) => a + counts[s], 0);
  const parts = statusSegments(counts).map((s) => `${s.count} ${STATUS_LABEL[s.status]}`);
  return `Status of ${total} muscles: ${parts.join(', ')}`;
}

/** "+5 vs last week", "-2 vs last week", "Same as last week". */
export function deltaText(delta: number): string {
  if (delta === 0) return 'Same as last week';
  return `${delta > 0 ? '+' : '−'}${fmtSets(Math.abs(delta))} vs last week`;
}

export type Grouping = 'muscle' | 'group';

const GROUP_ORDER: MuscleGroup[] = ['push', 'pull', 'legs', 'core'];
export const GROUP_LABEL: Record<MuscleGroup, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  core: 'Core',
};
const GROUP_OF = new Map<string, MuscleGroup>(MUSCLES.map((m) => [m.id, m.group]));

export interface MuscleGroupRows {
  key: string;
  /** Null for the single ungrouped list. */
  label: string | null;
  muscles: MuscleWeek[];
}

/** Sort, then either keep one flat list or bucket into push/pull/legs/core (empty groups dropped). */
export function groupMuscles(
  muscles: MuscleWeek[],
  grouping: Grouping,
  sort: SortKey,
): MuscleGroupRows[] {
  const sorted = sortMuscles(muscles, sort);
  if (grouping === 'muscle') return [{ key: 'all', label: null, muscles: sorted }];
  return GROUP_ORDER.map((g) => ({
    key: g,
    label: GROUP_LABEL[g],
    muscles: sorted.filter((m) => GROUP_OF.get(m.muscleId) === g),
  })).filter((g) => g.muscles.length > 0);
}

/** First `limit` of a list unless expanded. */
export function visibleCount(total: number, limit: number, expanded: boolean): number {
  return expanded ? total : Math.min(total, limit);
}

export interface ContributionBar {
  exerciseId: string;
  sets: number;
  weightedSets: number;
  /** Share of the muscle's weighted volume, 0-100. */
  pct: number;
}

export function contributionBars(contributions: MuscleContribution[]): ContributionBar[] {
  const total = contributions.reduce((a, c) => a + c.weightedSets, 0);
  return contributions.map((c) => ({
    exerciseId: c.exerciseId,
    sets: c.sets,
    weightedSets: r1(c.weightedSets),
    pct: total === 0 ? 0 : (c.weightedSets / total) * 100,
  }));
}

/** Last `n` points of a trend (the sparkline window). */
export const lastWeeks = <T>(points: T[], n: number): T[] =>
  points.slice(Math.max(0, points.length - n));
