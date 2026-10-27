import { useState } from 'react';
import { MUSCLES } from '@/data';
import type { MuscleId } from '@/data';
import { TRAINING } from '@/config/training';
import { CHART } from '@/components/analyze/statusStyle';
import { useLongTrend } from '@/db/progressHooks';
import { fmtDay, paddedRange, round1, scale } from './chartMath';

const W = 320;
const H = 150;
const PAD = { l: 30, r: 8, t: 8, b: 18 };

interface Props {
  /** Fixed muscle; omit to show a selector. */
  muscleId?: MuscleId;
  /** Initial muscle when the selector is shown. */
  defaultMuscleId?: MuscleId;
}

/** Weekly weighted sets for one muscle over `longTrendWeeks`, with MEV / MRV reference lines. */
export default function VolumeTrendChart({ muscleId, defaultMuscleId = 'chest' }: Props) {
  const [picked, setPicked] = useState<MuscleId>(defaultMuscleId);
  const data = useLongTrend();
  const id = muscleId ?? picked;
  const name = MUSCLES.find((m) => m.id === id)?.name ?? id;

  const selector = muscleId ? null : (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium">Muscle</span>
      <select
        value={picked}
        onChange={(e) => setPicked(e.target.value as MuscleId)}
        className="border-input bg-background min-h-11 rounded-md border px-2"
        data-testid="trend-muscle"
      >
        {MUSCLES.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );

  if (!data) return null;
  const points = data.trend[id];
  const target = data.targets[id];
  const active = points.filter((p) => p.sets > 0).length;
  const weeks = TRAINING.longTrendWeeks + 1;

  if (active < TRAINING.charts.minSessions) {
    return (
      <div className="space-y-2" data-testid="volume-trend">
        {selector}
        <p className="text-muted-foreground text-sm" data-testid="volume-trend-empty">
          Not enough data yet: train {name.toLowerCase()} in at least {TRAINING.charts.minSessions}{' '}
          weeks to see a {weeks}-week trend.
        </p>
      </div>
    );
  }

  const vals = points.map((p) => round1(p.sets));
  const [, hiRaw] = paddedRange(vals, [target.mev, target.mrv]);
  const hi = hiRaw;
  const lo = 0;
  const n = points.length;
  const x = (i: number) => (n === 1 ? (W + PAD.l) / 2 : scale(i, 0, n - 1, PAD.l, W - PAD.r));
  const y = (v: number) => scale(v, lo, hi, H - PAD.b, PAD.t);
  const path = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const latest = vals[n - 1];
  const peakIdx = vals.indexOf(Math.max(...vals));
  const avg = round1(vals.reduce((a, b) => a + b, 0) / n);
  const summary = `${name} weekly sets over ${n} weeks: latest ${latest}, peak ${vals[peakIdx]} (week of ${fmtDay(points[peakIdx].window.start)}), average ${avg}. Target range: minimum ${target.mev}, maximum ${target.mrv} sets.`;

  return (
    <div className="space-y-2" data-testid="volume-trend">
      {selector}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="h-auto w-full">
        <rect
          x={PAD.l}
          y={y(target.mavHigh)}
          width={W - PAD.l - PAD.r}
          height={y(target.mavLow) - y(target.mavHigh)}
          fill={CHART.band}
        />
        {(
          [
            ['MEV', target.mev],
            ['MRV', target.mrv],
          ] as const
        ).map(([label, v]) => (
          <g key={label}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(v)}
              y2={y(v)}
              stroke={CHART.marker}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text x={PAD.l + 2} y={y(v) - 2} fontSize={9} fill={CHART.axis}>
              {label} {v}
            </text>
          </g>
        ))}
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke={CHART.grid} />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke={CHART.grid} />
        <text x={PAD.l - 4} y={y(0) + 3} textAnchor="end" fontSize={9} fill={CHART.axis}>
          0
        </text>
        <path d={path} fill="none" stroke={CHART.line} strokeWidth={2} strokeLinejoin="round" />
        {vals.map((v, i) => (
          <circle key={points[i].window.start} cx={x(i)} cy={y(v)} r={2.5} fill={CHART.line} />
        ))}
        <text x={PAD.l} y={H - 4} fontSize={9} fill={CHART.axis}>
          {fmtDay(points[0].window.start)}
        </text>
        <text x={W - PAD.r} y={H - 4} fontSize={9} textAnchor="end" fill={CHART.axis}>
          this week
        </text>
      </svg>
      <p className="text-muted-foreground text-sm" data-testid="volume-trend-summary">
        {name}: {latest} sets this week, peak {vals[peakIdx]}, {n}-week average {avg}. Dashed lines
        mark MEV ({target.mev}) and MRV ({target.mrv}).
      </p>
    </div>
  );
}
