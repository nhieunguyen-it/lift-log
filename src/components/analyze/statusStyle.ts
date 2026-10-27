import type { MuscleStatus } from '@/analyzer';

export const STATUS_ORDER: MuscleStatus[] = [
  'none',
  'below',
  'building',
  'optimal',
  'high',
  'over',
];

export const STATUS_LABEL: Record<MuscleStatus, string> = {
  none: 'no sets',
  below: 'below target',
  building: 'building',
  optimal: 'in target range',
  high: 'high',
  over: 'over recoverable volume',
};

/** Short word shown in badges and the legend. */
export const STATUS_WORD: Record<MuscleStatus, string> = {
  none: 'None',
  below: 'Below',
  building: 'Building',
  optimal: 'Optimal',
  high: 'High',
  over: 'Over',
};

export const STATUS_HINT: Record<MuscleStatus, string> = {
  none: 'No sets logged',
  below: 'Under minimum effective volume',
  building: 'Above minimum, under the adaptive range',
  optimal: 'Inside the adaptive range',
  high: 'Above the adaptive range',
  over: 'Above recoverable volume',
};

export function statusColors(status: MuscleStatus): { bg: string; fg: string; strong: string } {
  return {
    bg: `var(--st-${status}-bg)`,
    fg: `var(--st-${status}-fg)`,
    strong: `var(--st-${status}-strong)`,
  };
}

/** Phase 4: chart colour tokens (see index.css). Components use these, never raw colours. */
export const CHART = {
  line: 'var(--chart-line)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  track: 'var(--chart-track)',
  band: 'var(--chart-band)',
  marker: 'var(--chart-marker)',
  value: 'var(--chart-value)',
  selected: 'var(--map-selected)',
} as const;
