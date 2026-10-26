import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { nameFor, useExerciseLookup } from '@/db/customHooks';
import { useProgramAlternatives } from '@/db/programHooks';

interface Props {
  /** Exercise being swapped; dialog is open while set. */
  exerciseId: string | null;
  onPick: (newExerciseId: string) => void;
  onClose: () => void;
}

/** One-tap swap list from the alternatives engine (user's equipment only). */
export default function ProgramSwapDialog({ exerciseId, onPick, onClose }: Props) {
  const alts = useProgramAlternatives(exerciseId ?? undefined);
  const lookup = useExerciseLookup();
  return (
    <Dialog open={exerciseId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-dvh overflow-y-auto"
        data-testid="program-swap-dialog"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Swap {exerciseId ? nameFor(lookup, exerciseId) : 'exercise'}</DialogTitle>
          <DialogDescription>Similar exercises for your equipment.</DialogDescription>
        </DialogHeader>
        {alts === undefined ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : !alts || alts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No alternatives found for your equipment.</p>
        ) : (
          <ul className="space-y-2" data-testid="program-swap-list">
            {alts.map((a) => {
              const name = nameFor(lookup, a.exerciseId);
              const equipment = lookup?.get(a.exerciseId)?.equipment;
              return (
                <li key={a.exerciseId}>
                  <button
                    type="button"
                    className="hover:bg-secondary focus-visible:ring-ring flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border p-2 text-left focus-visible:ring-2 focus-visible:outline-none"
                    aria-label={`Swap to ${name}`}
                    data-testid="program-swap-item"
                    data-exercise-id={a.exerciseId}
                    onClick={() => {
                      onPick(a.exerciseId);
                      onClose();
                    }}
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium">{name}</span>
                      <span className="flex flex-wrap gap-1">
                        {equipment && <Badge variant="outline">{equipment}</Badge>}
                      </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs" title="Match score">
                      {Math.round(a.score * 100)}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
