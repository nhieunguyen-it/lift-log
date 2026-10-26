import { lazy, Suspense } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import AlternativesList from '@/components/recommend/AlternativesList';
import { useExerciseDetail, useExerciseInsight, useMuscles, useUnit } from '@/db';
import { formatWeight } from '@/lib/units';
import type { LoggedSet } from '@/analyzer';

const E1rmChart = lazy(() => import('@/components/progress/E1rmChart'));

interface Props {
  /** Dialog is open while an id is set. */
  exerciseId: string | null;
  onClose: () => void;
}

function captionFor(index: number, total: number): string {
  if (total === 2) return index === 0 ? 'Start' : 'End';
  return total === 1 ? 'Position' : `Step ${index + 1}`;
}

function setText(s: LoggedSet, unit: 'kg' | 'lbs'): string {
  return s.weightKg !== undefined
    ? `${formatWeight(s.weightKg, unit)} × ${s.reps}`
    : `${s.reps} reps`;
}

/** Exercise how-to dialog: images, muscles with weights. Overlays the page so no state is lost. */
export default function ExerciseDetailDialog({ exerciseId, onClose }: Props) {
  const detail = useExerciseDetail(exerciseId ?? undefined);
  const muscles = useMuscles();
  const names = new Map((muscles ?? []).map((m) => [m.id, m.name]));
  const ex = detail?.exercise;
  const insight = useExerciseInsight(exerciseId ?? undefined);
  const unit = useUnit() ?? 'kg';
  const stats = insight?.stats;

  return (
    <Dialog open={exerciseId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-dvh overflow-y-auto"
        data-testid="exercise-detail"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>{ex?.name ?? 'Exercise'}</DialogTitle>
          <DialogDescription className="sr-only">
            How to perform this exercise and the muscles it works.
          </DialogDescription>
        </DialogHeader>
        {ex && (
          <div className="space-y-3">
            <ul className="grid grid-cols-2 gap-2" data-testid="exercise-images">
              {ex.images.map((src, i) => {
                const caption = captionFor(i, ex.images.length);
                return (
                  <li key={src} className={ex.images.length === 1 ? 'col-span-2' : undefined}>
                    <figure>
                      <img
                        src={src}
                        alt={`${ex.name} – ${caption.toLowerCase()} position`}
                        loading="lazy"
                        className="bg-muted aspect-[4/3] w-full rounded-md object-cover"
                      />
                      <figcaption className="text-muted-foreground mt-1 text-center text-xs">
                        {caption}
                      </figcaption>
                    </figure>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">{ex.equipment}</Badge>
              <Badge variant="outline">{ex.mechanic}</Badge>
              <Badge variant="outline">{ex.level}</Badge>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Muscles worked</p>
              <div className="flex flex-wrap gap-1">
                {detail.muscles.map((l) => (
                  <Badge key={l.muscleId} variant="secondary">
                    {names.get(l.muscleId) ?? l.muscleId} {Math.round(l.weight * 100)}%
                  </Badge>
                ))}
              </div>
            </div>
            <section aria-labelledby="ex-history" data-testid="exercise-history">
              <p id="ex-history" className="mb-1 text-sm font-medium">
                Your history
              </p>
              {stats?.bestSet ? (
                <ul className="text-muted-foreground space-y-0.5 text-sm">
                  <li>Best set: {setText(stats.bestSet, unit)}</li>
                  {stats.estimated1RmKg !== undefined && (
                    <li>Estimated 1RM: {formatWeight(stats.estimated1RmKg, unit)}</li>
                  )}
                  {stats.lastSession && (
                    <li>
                      Last session: {stats.lastSession.sets.map((s) => setText(s, unit)).join(', ')}
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">No history for this exercise yet</p>
              )}
            </section>
            <section aria-labelledby="ex-e1rm" data-testid="exercise-e1rm">
              <p id="ex-e1rm" className="mb-1 text-sm font-medium">
                Strength trend
              </p>
              <Suspense fallback={<p className="text-muted-foreground text-sm">Loading chart…</p>}>
                <E1rmChart exerciseId={ex.id} />
              </Suspense>
            </section>
            <section aria-labelledby="ex-alts" data-testid="exercise-alternatives">
              <p id="ex-alts" className="mb-1 text-sm font-medium">
                Alternatives
              </p>
              <AlternativesList exerciseId={ex.id} />
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
