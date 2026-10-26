import { Badge } from '@/components/ui/badge';
import { MUSCLES } from '@/data';
import { useAlternatives, useExercisesWithMuscles } from '@/db';
import { cn } from '@/lib/utils';

interface Props {
  exerciseId: string;
  /** When set, each row becomes a button calling this with the chosen exercise id. */
  onPick?: (exerciseId: string) => void;
}

const muscleName = new Map(MUSCLES.map((m) => [m.id, m.name]));

/** Top alternatives for an exercise; read-only unless `onPick` is given. */
export default function AlternativesList({ exerciseId, onPick }: Props) {
  const alts = useAlternatives(exerciseId);
  const all = useExercisesWithMuscles();
  const byId = new Map((all ?? []).map((e) => [e.exercise.id, e]));

  if (alts === undefined) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (!alts || alts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" data-testid="alternatives-empty">
        No alternatives found for your equipment.
      </p>
    );
  }

  return (
    <ul className="space-y-2" data-testid="alternatives-list">
      {alts.map((a) => {
        const item = byId.get(a.exerciseId);
        const name = item?.exercise.name ?? a.exerciseId;
        const primary = (item?.muscles ?? []).filter((m) => m.weight === 1).slice(0, 3);
        const body = (
          <>
            <span className="flex min-w-0 flex-col gap-1 text-left">
              <span className="font-medium">{name}</span>
              <span className="flex flex-wrap gap-1">
                {primary.map((m) => (
                  <Badge key={m.muscleId} variant="secondary">
                    {muscleName.get(m.muscleId) ?? m.muscleId}
                  </Badge>
                ))}
                {a.doneThisWeek && <Badge variant="outline">done this week</Badge>}
              </span>
            </span>
            <span className="text-muted-foreground shrink-0 text-xs" title="Match score">
              {Math.round(a.score * 100)}%
            </span>
          </>
        );
        const cls = 'flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border p-2';
        return (
          <li key={a.exerciseId} data-testid="alternative-item">
            {onPick ? (
              <button
                type="button"
                className={cn(
                  cls,
                  'hover:bg-secondary focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none',
                )}
                aria-label={`Swap to ${name}`}
                onClick={() => onPick(a.exerciseId)}
              >
                {body}
              </button>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
