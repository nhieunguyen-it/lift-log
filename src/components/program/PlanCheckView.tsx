import { MUSCLES } from '@/data';
import type { PlanCheck } from '@/program/types';
import StatusBadge from '@/components/analyze/StatusBadge';
import { formatSets } from './format';

const muscleName = new Map(MUSCLES.map((m) => [m.id, m.name]));

interface Props {
  check: PlanCheck;
  /** Resolves exercise ids to names for the unknown-exercise warning. */
  nameFor?: (exerciseId: string) => string;
}

/** Projected weekly weighted sets per muscle with status and warnings. */
export default function PlanCheckView({ check, nameFor }: Props) {
  const rows = MUSCLES.map((m) => check.muscles[m.id]);
  return (
    <section aria-labelledby="plan-check-heading" className="space-y-3" data-testid="plan-check">
      <h2 id="plan-check-heading" className="text-lg font-medium">
        Weekly volume check
      </h2>
      <p className="text-muted-foreground text-sm">
        Projected weighted sets per muscle if you do every day once.
      </p>

      {check.warnings.length > 0 && (
        <ul
          className="bg-secondary space-y-1 rounded-lg border p-3 text-sm"
          data-testid="plan-warnings"
          aria-label="Plan warnings"
        >
          {check.warnings.map((w) => (
            <li key={`${w.muscleId}-${w.kind}`} data-testid="plan-warning">
              <span className="font-medium">{muscleName.get(w.muscleId) ?? w.muscleId}</span>
              {w.kind === 'below_mev'
                ? ` gets ${formatSets(w.sets)} sets, below the ${w.threshold} needed to grow.`
                : ` gets ${formatSets(w.sets)} sets, above the ${w.threshold} you can recover from.`}
            </li>
          ))}
        </ul>
      )}
      {check.unknownExerciseIds.length > 0 && (
        <p className="text-sm" role="status" data-testid="plan-unknown">
          Not counted (exercise no longer exists):{' '}
          {check.unknownExerciseIds.map((id) => nameFor?.(id) ?? id).join(', ')}
        </p>
      )}

      <ul className="divide-y rounded-lg border">
        {rows.map((r) => {
          const pct = Math.min(100, (r.sets / r.target.mrv) * 100);
          return (
            <li
              key={r.muscleId}
              className="flex items-center gap-3 px-3 py-2"
              data-testid="plan-muscle"
              data-muscle-id={r.muscleId}
              data-status={r.status}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{muscleName.get(r.muscleId)}</span>
                  <span className="text-sm tabular-nums">
                    {formatSets(r.sets)}{' '}
                    <span className="text-muted-foreground text-xs">
                      / {r.target.mavLow}-{r.target.mavHigh}
                    </span>
                  </span>
                </div>
                <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full" aria-hidden>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: `var(--st-${r.status}-fg)` }}
                  />
                </div>
              </div>
              <StatusBadge status={r.status} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
