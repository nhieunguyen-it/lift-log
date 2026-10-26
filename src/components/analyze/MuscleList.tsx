import { useState } from 'react';
import type { MuscleWeek } from '@/analyzer';
import type { MuscleId } from '@/data';
import { fmtSets, muscleName, sortMuscles } from './muscleSort';
import type { SortKey } from './muscleSort';
import StatusBadge from './StatusBadge';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'distance', label: 'Needs most' },
  { key: 'name', label: 'Name' },
  { key: 'sets', label: 'Sets' },
  { key: 'status', label: 'Status' },
];

export default function MuscleList({
  muscles,
  onSelect,
}: {
  muscles: Record<MuscleId, MuscleWeek>;
  onSelect: (id: MuscleId) => void;
}) {
  const [sort, setSort] = useState<SortKey>('distance');
  const rows = sortMuscles(Object.values(muscles), sort);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Muscles</h2>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
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
      </div>
      <ul className="divide-border divide-y rounded-lg border">
        {rows.map((m) => (
          <li key={m.muscleId}>
            <button
              type="button"
              data-testid="muscle-row"
              data-muscle-id={m.muscleId}
              data-status={m.status}
              onClick={() => onSelect(m.muscleId)}
              className="focus-visible:ring-ring/50 flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{muscleName(m.muscleId)}</span>
                <span className="text-muted-foreground block text-xs">
                  {fmtSets(m.sets)} / {m.target.mavLow}–{m.target.mavHigh} sets
                </span>
              </span>
              <StatusBadge status={m.status} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
