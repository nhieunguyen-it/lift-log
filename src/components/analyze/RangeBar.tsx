import type { MuscleWeek } from '@/analyzer';
import { TRAINING } from '@/config/training';
import { rangeBarGeometry } from './analyzeModel';
import { CHART, statusColors } from './statusStyle';

/**
 * Horizontal range bar: shaded MAV band, ticks at MEV and MRV, and a filled value bar.
 * Decorative (aria-hidden): the row's accessible name carries the numbers.
 */
export default function RangeBar({
  sets,
  status,
  target,
}: Pick<MuscleWeek, 'sets' | 'status' | 'target'>) {
  const g = rangeBarGeometry(sets, target, TRAINING.charts.rangeBarHeadroom);
  const tick = 1;
  return (
    <svg
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      className="block h-3 w-full"
      aria-hidden="true"
      data-testid="range-bar"
    >
      <rect x="0" y="0" width="100" height="10" rx="1" fill={CHART.track} />
      <rect
        x={g.mavLow}
        y="0"
        width={Math.max(0, g.mavHigh - g.mavLow)}
        height="10"
        fill={CHART.band}
      />
      <rect x="0" y="3" width={g.value} height="4" fill={statusColors(status).strong} />
      <rect x={Math.max(0, g.mev - tick / 2)} y="0" width={tick} height="10" fill={CHART.marker} />
      <rect
        x={Math.min(100 - tick, g.mrv - tick / 2)}
        y="0"
        width={tick}
        height="10"
        fill={CHART.marker}
      />
      {g.overflow && <rect x="97" y="0" width="3" height="10" fill={statusColors(status).strong} />}
    </svg>
  );
}
