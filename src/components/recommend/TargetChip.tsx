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
    const weight = target.weightKg !== undefined && !noHistory ? target.weightKg : undefined;
    // First open row with an empty field; only empty fields are filled.
    const row = sets.find(
      (s) =>
        s.completedAt === undefined &&
        (s.reps === 0 || (weight !== undefined && s.weightKg === undefined)),
    );
    if (row) {
      const patch: { weightKg?: number; reps?: number } = {};
      if (weight !== undefined && row.weightKg === undefined) patch.weightKg = weight;
      if (row.reps === 0) patch.reps = target.targetReps;
      if (Object.keys(patch).length > 0) await setsRepo.updateSet(row.id, patch);
      return;
    }
    // A new row is prefilled from earlier sets; nothing was typed yet, so the target replaces it.
    const added = await setsRepo.addSet(sessionExerciseId);
    await setsRepo.updateSet(added.id, {
      reps: target.targetReps,
      ...(weight !== undefined ? { weightKg: weight } : {}),
    });
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
