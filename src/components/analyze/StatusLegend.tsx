import type { MuscleStatus } from '@/analyzer';
import { cn } from '@/lib/utils';
import { STATUS_HINT, STATUS_ORDER, STATUS_WORD, statusColors } from './statusStyle';

interface Props {
  counts?: Partial<Record<MuscleStatus, number>>;
  /** Status currently highlighted on the map, or null. */
  active: MuscleStatus | null;
  /** Called with the tapped status, or null when the active one is tapped again. */
  onChange: (s: MuscleStatus | null) => void;
}

/** Legend that doubles as a map filter: tap a status to highlight only those muscles. */
export default function StatusLegend({ counts, active, onChange }: Props) {
  return (
    <ul aria-label="Legend: filter the map by status" className="space-y-0.5">
      {STATUS_ORDER.map((s) => {
        const pressed = active === s;
        const c = statusColors(s);
        return (
          <li key={s}>
            <button
              type="button"
              data-testid={`legend-filter-${s}`}
              aria-pressed={pressed}
              title={STATUS_HINT[s]}
              onClick={() => onChange(pressed ? null : s)}
              className={cn(
                'focus-visible:ring-ring/50 flex min-h-9 w-full items-center gap-2 rounded-md border border-transparent px-1.5 text-left text-xs outline-none focus-visible:ring-[3px]',
                pressed && 'bg-muted border-foreground font-semibold',
              )}
            >
              <span
                aria-hidden="true"
                className="size-3.5 shrink-0 rounded-sm border"
                style={{ backgroundColor: c.bg, borderColor: c.fg }}
              />
              <span className="min-w-0 flex-1">{STATUS_WORD[s]}</span>
              {counts && (
                <span className="text-muted-foreground tabular-nums">{counts[s] ?? 0}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
