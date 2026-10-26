import { TRAINING } from '@/config/training';
import { useUnit } from '@/db/hooks';
import { useE1rmHistory } from '@/db/progressHooks';
import { formatWeight } from '@/lib/units';
import { kgToDisplay } from '@/lib/weight';
import type { LoggedSet } from '@/analyzer';
import { fmtDay, paddedRange, round1, scale } from './chartMath';

const W = 320;
const H = 140;
const PAD = { l: 36, r: 8, t: 8, b: 18 };

function setText(s: LoggedSet, unit: 'kg' | 'lbs'): string {
  return s.weightKg !== undefined && s.weightKg > 0
    ? `${formatWeight(s.weightKg, unit)} × ${s.reps}`
    : `${s.reps} reps`;
}

/** Estimated 1RM over time for one exercise, plus the best set of each session. */
export default function E1rmChart({ exerciseId }: { exerciseId: string }) {
  const points = useE1rmHistory(exerciseId);
  const unit = useUnit() ?? 'kg';
  if (points === undefined) return null;

  if (points.length < TRAINING.charts.minSessions) {
    return (
      <p className="text-muted-foreground text-sm" data-testid="e1rm-empty">
        Log at least {TRAINING.charts.minSessions} sessions with weight to see your estimated 1RM
        trend.
      </p>
    );
  }

  const vals = points.map((p) => kgToDisplay(p.e1rmKg, unit));
  const [lo, hi] = paddedRange(vals);
  const t0 = points[0].startedAt;
  const t1 = points[points.length - 1].startedAt;
  const x = (t: number) =>
    t1 === t0 ? (PAD.l + W - PAD.r) / 2 : scale(t, t0, t1, PAD.l, W - PAD.r);
  const y = (v: number) => scale(v, lo, hi, H - PAD.b, PAD.t);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.startedAt)},${y(vals[i])}`).join(' ');

  const start = vals[0];
  const latest = vals[vals.length - 1];
  const peak = Math.max(...vals);
  const change = start === 0 ? 0 : ((latest - start) / start) * 100;
  const changeText = `${change >= 0 ? '+' : ''}${round1(change)}%`;
  const summary = `Estimated 1RM over ${points.length} sessions: started at ${start} ${unit}, peak ${peak} ${unit}, latest ${latest} ${unit}, change ${changeText}.`;
  const recent = [...points].reverse().slice(0, 8);

  return (
    <div className="space-y-2" data-testid="e1rm-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={summary}
        className="text-foreground h-auto w-full"
      >
        {[lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1].map((v) => (
          <g key={v}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD.l - 4}
              y={y(v) + 3}
              textAnchor="end"
              fontSize={9}
              fill="var(--muted-foreground)"
            >
              {Math.round(v)}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={p.sessionId}
            cx={x(p.startedAt)}
            cy={y(vals[i])}
            r={2.5}
            fill="currentColor"
          />
        ))}
        <text x={PAD.l} y={H - 4} fontSize={9} fill="var(--muted-foreground)">
          {fmtDay(t0)}
        </text>
        <text x={W - PAD.r} y={H - 4} fontSize={9} textAnchor="end" fill="var(--muted-foreground)">
          {fmtDay(t1)}
        </text>
      </svg>
      <p className="text-muted-foreground text-sm" data-testid="e1rm-summary">
        Start {start} {unit}, peak {peak} {unit}, latest {latest} {unit} ({changeText}).
      </p>
      <div>
        <p className="mb-1 text-sm font-medium">Best set per session</p>
        <ul className="text-muted-foreground space-y-0.5 text-sm" data-testid="best-set-history">
          {recent.map((p) => (
            <li key={p.sessionId} className="flex justify-between gap-2">
              <span>{fmtDay(p.startedAt)}</span>
              <span>
                {setText(p.bestSet, unit)} · e1RM {formatWeight(p.e1rmKg, unit)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
