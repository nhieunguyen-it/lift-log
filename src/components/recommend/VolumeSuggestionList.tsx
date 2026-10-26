import { useState } from 'react';
import { AlertTriangle, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MUSCLES, exercises, type MuscleId } from '@/data';
import type { VolumeSuggestion } from '@/recommend';

const muscleName = new Map(MUSCLES.map((m) => [m.id, m.name]));
const exerciseName = new Map(exercises.map((e) => [e.id, e.name]));

interface Props {
  suggestions: VolumeSuggestion[];
  /** Makes each item a button that opens that muscle. */
  onSelect?: (muscleId: MuscleId) => void;
  /** Show this many items until "Show all" is pressed. */
  limit?: number;
}

export default function VolumeSuggestionList({ suggestions, onSelect, limit }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (suggestions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" data-testid="volume-suggestions">
        No volume changes suggested this week.
      </p>
    );
  }
  const shown = limit && !expanded ? suggestions.slice(0, limit) : suggestions;
  const hidden = suggestions.length - shown.length;
  const wrap = (muscleId: MuscleId, body: React.ReactNode) =>
    onSelect ? (
      <button
        type="button"
        className="min-h-11 flex-1 text-left"
        onClick={() => onSelect(muscleId)}
      >
        {body}
      </button>
    ) : (
      <span>{body}</span>
    );
  return (
    <>
      <ul className="space-y-2" data-testid="volume-suggestions">
        {shown.map((s) => {
          const name = muscleName.get(s.muscleId) ?? s.muscleId;
          if (s.kind === 'add') {
            const names = s.exercises
              .slice(0, 3)
              .map((e) => exerciseName.get(e.exerciseId) ?? e.exerciseId)
              .join(', ');
            return (
              <li key={`add-${s.muscleId}`} className="flex gap-2 rounded-lg border p-3 text-sm">
                <PlusCircle className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {wrap(
                  s.muscleId,
                  <>
                    <strong>{name}</strong>: add {s.setsToAdd} {s.setsToAdd === 1 ? 'set' : 'sets'}
                    {names && <> — {names}</>}
                  </>,
                )}
              </li>
            );
          }
          return (
            <li
              key={`over-${s.muscleId}`}
              className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            >
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              {wrap(
                s.muscleId,
                <>
                  <strong>{name}</strong>: {Math.round(s.current * 10) / 10} sets is above the usual
                  ceiling ({s.mrv}). Consider easing off to recover.
                </>,
              )}
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <Button variant="ghost" className="w-full" onClick={() => setExpanded(true)}>
          Show {hidden} more
        </Button>
      )}
    </>
  );
}
