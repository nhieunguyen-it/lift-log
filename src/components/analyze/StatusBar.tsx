import type { MuscleStatus } from '@/analyzer';
import { statusBarLabel, statusSegments } from './analyzeModel';
import { STATUS_WORD, statusColors } from './statusStyle';

/** Segmented status bar with text counts below (status is never colour alone). */
export default function StatusBar({ counts }: { counts: Record<MuscleStatus, number> }) {
  const segs = statusSegments(counts);
  return (
    <div className="space-y-1.5" data-testid="status-bar">
      <div
        role="img"
        aria-label={statusBarLabel(counts)}
        className="bg-background flex h-2.5 w-full gap-px overflow-hidden rounded-full"
      >
        {segs.map((s) => (
          <span
            key={s.status}
            style={{ width: `${s.pct}%`, backgroundColor: statusColors(s.status).strong }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" aria-hidden="true">
        {segs.map((s) => (
          <li key={s.status} className="flex items-center gap-1">
            <span
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: statusColors(s.status).strong }}
            />
            <span className="font-medium">{s.count}</span>
            <span className="text-muted-foreground">{STATUS_WORD[s.status]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
