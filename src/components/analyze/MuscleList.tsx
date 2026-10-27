import { useState } from 'react';
import type { AnalyzerResult, MuscleWeek } from '@/analyzer';
import type { MuscleId } from '@/data';
import { TRAINING } from '@/config/training';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { groupMuscles, lastWeeks, muscleSrText, visibleCount } from './analyzeModel';
import type { Grouping } from './analyzeModel';
import { fmtSets, muscleName } from './muscleSort';
import type { SortKey } from './muscleSort';
import RangeBar from './RangeBar';
import Sparkline from './Sparkline';
import StatusBadge from './StatusBadge';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'distance', label: 'Needs most' },
  { key: 'name', label: 'Name' },
  { key: 'sets', label: 'Sets' },
  { key: 'status', label: 'Status' },
];

interface Props {
  muscles: Record<MuscleId, MuscleWeek>;
  trend: AnalyzerResult['trend'];
  grouping: Grouping;
  onGroupingChange: (g: Grouping) => void;
  onSelect: (id: MuscleId) => void;
}

export default function MuscleList({
  muscles,
  trend,
  grouping,
  onGroupingChange,
  onSelect,
}: Props) {
  const [sort, setSort] = useState<SortKey>('distance');
  const [expanded, setExpanded] = useState(false);
  const all = Object.values(muscles);
  const groups = groupMuscles(all, grouping, sort);
  const limit = TRAINING.analyzeUi.collapsedRows;
  const shownCount = visibleCount(all.length, limit, expanded);
  let index = 0;

  return (
    <section className="space-y-2" aria-labelledby="muscles-h" data-testid="muscle-list">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="muscles-h" className="text-base font-medium">
          Muscles
        </h2>
        <div
          role="group"
          aria-label="Group muscles"
          data-testid="grouping-toggle"
          className="bg-muted flex rounded-md p-0.5"
        >
          {(
            [
              ['muscle', 'By muscle'],
              ['group', 'By group'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              data-testid={`grouping-${k}`}
              aria-pressed={grouping === k}
              onClick={() => onGroupingChange(k)}
              className={cn(
                'focus-visible:ring-ring/50 min-h-9 rounded px-3 text-xs font-medium outline-none focus-visible:ring-[3px]',
                grouping === k ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="text-muted-foreground flex items-center justify-end gap-2 text-xs">
        Sort by
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          data-testid="muscle-sort"
          className="border-input bg-background text-foreground focus-visible:ring-ring/50 h-11 rounded-md border px-2 text-sm outline-none focus-visible:ring-[3px]"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-muted-foreground text-xs">
        Bars: shaded band is the MAV range, ticks mark MEV and MRV, the fill is this week.
      </p>

      {groups.map((g) => {
        const start = index;
        const rows = g.muscles.map((m) => ({ m, hidden: index++ >= shownCount }));
        const groupHidden = start >= shownCount;
        return (
          <div key={g.key} hidden={groupHidden} className="space-y-1">
            {g.label && <h3 className="text-muted-foreground text-sm font-medium">{g.label}</h3>}
            <ul className="divide-border divide-y rounded-lg border">
              {rows.map(({ m, hidden }) => (
                <li key={m.muscleId} hidden={hidden} data-testid={`muscle-row-${m.muscleId}`}>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 px-3 py-1.5">
                    <button
                      type="button"
                      data-testid="muscle-row"
                      data-muscle-id={m.muscleId}
                      data-status={m.status}
                      aria-label={`${muscleSrText(m)}. Open details`}
                      onClick={() => onSelect(m.muscleId)}
                      className="focus-visible:ring-ring/50 min-h-11 min-w-0 space-y-1 rounded-sm py-0.5 text-left outline-none focus-visible:ring-[3px]"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {muscleName(m.muscleId)}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {fmtSets(m.sets)} / {m.target.mavLow}–{m.target.mavHigh} sets
                          </span>
                        </span>
                        <StatusBadge status={m.status} />
                      </span>
                      <RangeBar sets={m.sets} status={m.status} target={m.target} />
                    </button>
                    {trend[m.muscleId] && (
                      <Sparkline
                        compact
                        label={muscleName(m.muscleId)}
                        mev={m.target.mev}
                        points={lastWeeks(trend[m.muscleId], TRAINING.charts.sparklineWeeks)}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {all.length > limit && (
        <Button
          variant="ghost"
          className="min-h-11 w-full"
          aria-expanded={expanded}
          data-testid="muscle-show-all"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show fewer' : `Show all ${all.length}`}
        </Button>
      )}
    </section>
  );
}
