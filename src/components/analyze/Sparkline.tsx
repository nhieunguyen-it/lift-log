import type { MuscleTrendPoint } from '@/analyzer';

const fmtDay = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Tiny accessible bar chart of weekly sets, oldest to newest. */
export default function Sparkline({ points, mev }: { points: MuscleTrendPoint[]; mev?: number }) {
  const max = Math.max(1, mev ?? 0, ...points.map((p) => p.sets));
  const W = 200;
  const H = 56;
  const gap = 6;
  const bw = (W - gap * (points.length - 1)) / Math.max(1, points.length);
  const label =
    'Weekly sets, oldest to newest: ' +
    points
      .map(
        (p, i) =>
          `week of ${fmtDay(p.window.start)}${i === points.length - 1 ? ' (this week)' : ''} ${Math.round(p.sets * 10) / 10}`,
      )
      .join(', ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H + 14}`}
      role="img"
      aria-label={label}
      className="h-auto w-full max-w-xs"
    >
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
              rx={2}
              fill={last ? 'var(--foreground)' : 'var(--muted-foreground)'}
              opacity={last ? 1 : 0.6}
            />
            <text
              x={x + bw / 2}
              y={H + 11}
              textAnchor="middle"
              fontSize="9"
              fill="var(--muted-foreground)"
            >
              {Math.round(p.sets * 10) / 10}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
