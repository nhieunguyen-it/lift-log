import type { MuscleId } from '@/data';
import type { MuscleWeek } from '@/analyzer';
import { cn } from '@/lib/utils';
import { VIEW_BOX, SILHOUETTE } from './bodyMapPaths';
import type { BodyView } from './bodyMapPaths';
import { regionsFor } from './muscleMapping';
import { fmtSets, muscleName } from './muscleSort';
import { STATUS_LABEL } from './statusStyle';

interface Props {
  muscles: Record<MuscleId, MuscleWeek>;
  onSelect: (id: MuscleId) => void;
}

function View({ view, muscles, onSelect }: Props & { view: BodyView }) {
  return (
    <figure className="min-w-0 flex-1">
      <svg
        viewBox={VIEW_BOX}
        className="mx-auto h-auto w-full max-w-[11rem]"
        role="group"
        aria-label={`${view === 'front' ? 'Front' : 'Back'} view`}
      >
        {SILHOUETTE.map((d, i) => (
          <path key={i} d={d} fill="var(--body-silhouette)" aria-hidden="true" />
        ))}
        {regionsFor(view).map((r) => {
          const m = muscles[r.muscleId];
          const open = () => onSelect(r.muscleId);
          return (
            <path
              key={r.muscleId}
              d={r.d}
              fillRule="nonzero"
              role="button"
              tabIndex={0}
              aria-label={`${muscleName(r.muscleId)}: ${fmtSets(m.sets)} sets, ${STATUS_LABEL[m.status]}`}
              data-muscle-id={r.muscleId}
              data-status={m.status}
              onClick={open}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  open();
                }
              }}
              fill={`var(--st-${m.status}-bg)`}
              stroke={`var(--st-${m.status}-fg)`}
              strokeWidth={0.6}
              className={cn(
                'cursor-pointer outline-none transition-opacity hover:opacity-80',
                'focus-visible:stroke-[var(--ring-strong)] focus-visible:[stroke-width:2]',
              )}
              style={{ ['--ring-strong' as string]: 'var(--foreground)' }}
            />
          );
        })}
      </svg>
      <figcaption className="text-muted-foreground text-center text-xs">
        {view === 'front' ? 'Front' : 'Back'}
      </figcaption>
    </figure>
  );
}

export default function BodyMap(props: Props) {
  return (
    <div data-testid="body-map" className="flex gap-2">
      <View view="front" {...props} />
      <View view="back" {...props} />
    </div>
  );
}
