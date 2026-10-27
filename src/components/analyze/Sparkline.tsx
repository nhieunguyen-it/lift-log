import type { MuscleTrendPoint } from '@/analyzer';
import { CHART } from './statusStyle';

const fmtDay = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Accessible bar chart of weekly sets, oldest to newest. `compact` drops value labels. */
export default function Sparkline({
  points,
  mev,
  compact = false,
  label: prefix,
}: {
  points: MuscleTrendPoint[];
  mev?: number;
  compact?: boolean;
  /** Muscle name, prepended to the screen-reader text. */
  label?: string;
}) {
  const max = Math.max(1, mev ?? 0, ...points.map((p) => p.sets));
  const W = compact ? 60 : 200;
  const H = compact ? 24 : 56;
  const gap = compact ? 3 : 6;
  const bw = (W - gap * (points.length - 1)) / Math.max(1, points.length);
  const label =
    `${prefix ? `${prefix}: ` : ''}Weekly sets, oldest to newest: ` +
    points
      .map(
        (p, i) =>
          `week of ${fmtDay(p.window.start)}${i === points.length - 1 ? ' (this week)' : ''} ${r1(p.sets)}`,
      )
      .join(', ');
  return (
    <svg
      viewBox={`0 0 ${W} ${compact ? H : H + 14}`}
      role="img"
      aria-label={label}
      className={compact ? 'block h-6 w-[3.75rem]' : 'h-auto w-full max-w-xs'}
      data-testid="sparkline"
    >
      {mev !== undefined && (
        <line
          x1={0}
          x2={W}
          y1={H - (mev / max) * H}
          y2={H - (mev / max) * H}
          stroke={CHART.grid}
          strokeDasharray="2 2"
        />
      )}
      {points.map((p, i) => {
        const h = (p.sets / max) * H;
        const x = i * (bw + gap);
        const last = i === points.length - 1;
        return (
          <g key={p.window.start}>
            <rect
              x={x}
              y={H - h}
              width={bw}
              height={Math.max(h, 1)}
              rx={compact ? 1 : 2}
              fill={last ? CHART.value : CHART.axis}
              opacity={last ? 1 : 0.6}
            />
            {!compact && (
              <text x={x + bw / 2} y={H + 11} textAnchor="middle" fontSize="9" fill={CHART.axis}>
                {r1(p.sets)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
