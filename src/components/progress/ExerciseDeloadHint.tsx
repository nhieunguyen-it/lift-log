import { X } from 'lucide-react';
import { dismissDeload, useExerciseDeloadHint } from '@/db/progressHooks';

/** Phase 4: small dismissible fatigue hint under a workout target chip. Never changes data. */
export default function ExerciseDeloadHint({ exerciseId }: { exerciseId: string }) {
  const hint = useExerciseDeloadHint(exerciseId);
  if (!hint) return null;
  return (
    <div
      role="note"
      data-testid="exercise-deload-hint"
      className="bg-muted text-foreground flex items-start gap-2 rounded-lg px-3 py-1.5 text-xs"
    >
      <span className="flex-1">{hint.detail} — consider lighter sets.</span>
      <button
        type="button"
        aria-label="Dismiss fatigue hint"
        onClick={() => void dismissDeload(hint.key)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -m-2 flex size-11 shrink-0 items-center justify-center rounded focus-visible:ring-2 focus-visible:outline-none"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
