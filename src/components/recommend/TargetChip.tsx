import { Target } from 'lucide-react';
import { setsRepo, useExerciseInsight, type SetRow } from '@/db';

interface Props {
  exerciseId: string;
  sessionId: string;
  sessionExerciseId: string;
  sets: SetRow[];
}

/** Suggested target for the next set; one tap fills it into the first empty set row. */
export default function TargetChip({ exerciseId, sessionId, sessionExerciseId, sets }: Props) {
  const insight = useExerciseInsight(exerciseId, sessionId);
  if (!insight) return null;
  const { target } = insight;
  const noHistory = target.action === 'start';
  const text = noHistory
    ? `No history yet — target ${target.repRange.min}–${target.repRange.max} reps`
    : target.label;

  async function fill() {
    let row = sets.find(
      (s) => s.completedAt === undefined && s.weightKg === undefined && s.reps === 0,
    );
    if (!row) row = await setsRepo.addSet(sessionExerciseId);
    const patch: { weightKg?: number; reps?: number } = {};
    if (target.weightKg !== undefined && row.weightKg === undefined && !noHistory) {
      patch.weightKg = target.weightKg;
    }
    if (row.reps === 0) patch.reps = target.targetReps;
    if (Object.keys(patch).length > 0) await setsRepo.updateSet(row.id, patch);
  }

  return (
    <button
      type="button"
      data-testid="target-chip"
      aria-label={`Fill target: ${text}`}
      title={target.reason}
      onClick={() => void fill()}
      className="bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-ring flex min-h-11 w-full cursor-pointer flex-col items-start justify-center rounded-lg px-3 py-1 text-left focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Target className="size-4 shrink-0" aria-hidden="true" />
        {text}
      </span>
      {target.reason && <span className="text-muted-foreground text-xs">{target.reason}</span>}
    </button>
  );
}
