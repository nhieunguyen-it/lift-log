import { useId, useState } from 'react';
import type { MuscleStatus, MuscleWeek } from '@/analyzer';
import type { MuscleId } from '@/data';
import { TRAINING } from '@/config/training';
import { cn } from '@/lib/utils';
import { VIEW_BOX, SILHOUETTE } from './bodyMapPaths';
import type { BodyView } from './bodyMapPaths';
import { regionsFor } from './muscleMapping';
import { fmtSets, muscleName } from './muscleSort';
import StatusLegend from './StatusLegend';
import { CHART, STATUS_LABEL } from './statusStyle';

interface Props {
  muscles: Record<MuscleId, MuscleWeek>;
  selected?: MuscleId | null;
  onSelect: (id: MuscleId) => void;
  counts?: Partial<Record<MuscleStatus, number>>;
}

/** Statuses that get a texture on top of the colour, so status is never colour alone. */
const TEXTURED: MuscleStatus[] = ['none', 'below', 'over'];

function Patterns({ uid }: { uid: string }) {
  return (
    <defs>
      {TEXTURED.map((s) => (
        <pattern key={s} id={`${uid}-${s}`} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill={`var(--st-${s}-bg)`} />
          {s === 'none' && <circle cx="2" cy="2" r="0.6" fill={`var(--st-${s}-fg)`} />}
          {s === 'below' && <path d="M0 4L4 0" stroke={`var(--st-${s}-fg)`} strokeWidth="0.8" />}
          {s === 'over' && (
            <path d="M0 4L4 0M0 0L4 4" stroke={`var(--st-${s}-fg)`} strokeWidth="0.8" />
          )}
        </pattern>
      ))}
    </defs>
  );
}

function View({
  view,
  active,
  filter,
  muscles,
  selected,
  onSelect,
}: Omit<Props, 'counts'> & { view: BodyView; active: boolean; filter: MuscleStatus | null }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <div
      className={cn(
        'analyze-fade col-start-1 row-start-1',
        active ? 'visible opacity-100' : 'invisible opacity-0',
      )}
      aria-hidden={active ? undefined : true}
      inert={!active}
      data-view={view}
    >
      <svg
        viewBox={VIEW_BOX}
        className="mx-auto h-auto w-full"
        role="group"
        aria-label={`${view === 'front' ? 'Front' : 'Back'} view`}
      >
        <Patterns uid={uid} />
        {SILHOUETTE.map((d, i) => (
          <path key={i} d={d} fill="var(--body-silhouette)" aria-hidden="true" />
        ))}
        {regionsFor(view).map((r) => {
          const m = muscles[r.muscleId];
          const open = () => onSelect(r.muscleId);
          const isSel = selected === r.muscleId;
          const dim = filter !== null && m.status !== filter;
          return (
            <path
              key={r.muscleId}
              d={r.d}
              fillRule="nonzero"
              role="button"
              tabIndex={0}
              aria-label={`${muscleName(r.muscleId)}: ${fmtSets(m.sets)} sets, ${STATUS_LABEL[m.status]}`}
              aria-pressed={isSel}
              data-muscle-id={r.muscleId}
              data-status={m.status}
              onClick={open}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  open();
                }
              }}
              fill={
                TEXTURED.includes(m.status)
                  ? `url(#${uid}-${m.status})`
                  : `var(--st-${m.status}-bg)`
              }
              stroke={isSel ? CHART.selected : `var(--st-${m.status}-fg)`}
              strokeWidth={isSel ? 2 : 0.6}
              style={{ opacity: dim ? 'var(--map-dimmed-opacity)' : undefined }}
              className="analyze-fade cursor-pointer outline-none hover:opacity-80 focus-visible:[stroke-width:2.5]"
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function BodyMap({ muscles, selected, onSelect, counts }: Props) {
  const [view, setView] = useState<BodyView>('front');
  const [filter, setFilter] = useState<MuscleStatus | null>(null);
  const shared = { muscles, selected, onSelect, filter };
  return (
    <div
      data-testid="body-map"
      className="flex items-start gap-3"
      style={{ ['--analyze-ms' as string]: `${TRAINING.analyzeUi.transitionMs}ms` }}
    >
      <div className="w-36 shrink-0 space-y-1.5">
        <div className="grid">
          <View view="front" active={view === 'front'} {...shared} />
          <View view="back" active={view === 'back'} {...shared} />
        </div>
        <div role="group" aria-label="Body view" className="bg-muted flex rounded-md p-0.5">
          {(['front', 'back'] as const).map((v) => (
            <button
              key={v}
              type="button"
              data-testid={`map-view-${v}`}
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                'analyze-fade focus-visible:ring-ring/50 min-h-9 flex-1 rounded text-xs font-medium capitalize outline-none focus-visible:ring-[3px]',
                view === v ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <StatusLegend counts={counts} active={filter} onChange={setFilter} />
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {filter ? `Highlighting: ${STATUS_LABEL[filter]}.` : 'Tap a status to highlight muscles.'}
        </p>
      </div>
    </div>
  );
}
