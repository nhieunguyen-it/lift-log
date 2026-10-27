import { useState } from 'react';
import { TRAINING } from '@/config/training';
import { usePlanVsActual } from '@/db/planVsActualHooks';
import { fmtSets, muscleName } from './muscleSort';

/** Phase 4: shortfalls vs. the active program's plan and its skipped days. Hidden without a program. */
export default function PlanVsActualCard({ refTs }: { refTs: number }) {
  const view = usePlanVsActual(refTs);
  const [all, setAll] = useState(false);
  if (!view) return null;
  const { result, inProgress, blockWeek } = view;
  const short = result.muscles.filter((m) => m.gap < 0);
  const shown = all ? short : short.slice(0, TRAINING.analyzeUi.collapsedRows);
  const skipped = result.days.filter((d) => !d.done);
  return (
    <section aria-labelledby="pva-h" className="space-y-2" data-testid="plan-vs-actual">
      <h2 id="pva-h" className="text-base font-medium">
        Plan vs. actual
      </h2>
      <p className="text-muted-foreground text-sm">
        {view.programName}
        {blockWeek !== null && ` · block week ${blockWeek}`}: {result.daysDone} of{' '}
        {result.days.length} days done
      </p>
      {skipped.length > 0 && (
        <p className="text-sm" data-testid="pva-skipped">
          <span className="font-medium">{inProgress ? 'Not done yet' : 'Skipped'}:</span>{' '}
          {skipped.map((d) => d.name).join(', ')}
        </p>
      )}
      {short.length === 0 ? (
        <p className="text-sm">
          {inProgress
            ? 'No muscle is behind plan so far.'
            : 'Every muscle reached its planned sets.'}
        </p>
      ) : (
        <ul className="divide-border divide-y rounded-lg border text-sm">
          {shown.map((m) => (
            <li key={m.muscleId} className="flex justify-between gap-2 px-3 py-2">
              <span className="font-medium">{muscleName(m.muscleId)}</span>
              <span>
                {fmtSets(m.actual)} of {fmtSets(m.planned)} sets{' '}
                <span className="text-muted-foreground">({fmtSets(m.gap)})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {short.length > shown.length && (
        <button
          type="button"
          className="text-sm font-medium underline"
          onClick={() => setAll(true)}
        >
          Show all {short.length}
        </button>
      )}
    </section>
  );
}
