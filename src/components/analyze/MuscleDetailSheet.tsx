import type { AnalyzerResult, MuscleWeek } from '@/analyzer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { VolumeSuggestion } from '@/recommend';
import { fmtSets, muscleName } from './muscleSort';
import Sparkline from './Sparkline';
import StatusBadge from './StatusBadge';
import { STATUS_HINT } from './statusStyle';

export function suggestionText(s: VolumeSuggestion, names: (id: string) => string): string {
  if (s.kind === 'add') {
    const ex = s.exercises.map((e) => names(e.exerciseId)).join(', ');
    return `Add ${s.setsToAdd} set${s.setsToAdd === 1 ? '' : 's'}${ex ? ` — try ${ex}` : ''}`;
  }
  return `Above your recoverable volume (MRV ${s.mrv}); consider trimming a few sets`;
}

interface Props {
  muscle: MuscleWeek | null;
  trend: AnalyzerResult['trend'][keyof AnalyzerResult['trend']] | undefined;
  suggestion: VolumeSuggestion | undefined;
  exerciseName: (id: string) => string;
  onClose: () => void;
}

export default function MuscleDetailSheet({
  muscle,
  trend,
  suggestion,
  exerciseName,
  onClose,
}: Props) {
  return (
    <Dialog open={muscle !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="muscle-detail" className="max-h-[85dvh] overflow-y-auto">
        {muscle && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-10">
                {muscleName(muscle.muscleId)} <StatusBadge status={muscle.status} />
              </DialogTitle>
              <DialogDescription>
                {fmtSets(muscle.sets)} weighted sets this week. {STATUS_HINT[muscle.status]}.
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-4 gap-2 text-center text-xs">
              {(
                [
                  ['MEV', muscle.target.mev],
                  ['MAV low', muscle.target.mavLow],
                  ['MAV high', muscle.target.mavHigh],
                  ['MRV', muscle.target.mrv],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="bg-muted rounded-md p-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-base font-semibold">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-1">
              <h3 className="font-medium">Contributing exercises</h3>
              {muscle.contributions.length === 0 ? (
                <p className="text-muted-foreground text-sm">No sets logged this week.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {muscle.contributions.map((c) => {
                    const w = c.sets > 0 ? c.weightedSets / c.sets : 0;
                    return (
                      <li key={c.exerciseId}>
                        {exerciseName(c.exerciseId)} — {fmtSets(c.sets)} sets × {w} ={' '}
                        {c.weightedSets.toFixed(1)}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {trend && (
              <div className="space-y-1">
                <h3 className="font-medium">Last {trend.length} weeks</h3>
                <Sparkline points={trend} mev={muscle.target.mev} />
              </div>
            )}

            <p className="bg-muted rounded-md p-3 text-sm" data-testid="detail-suggestion">
              {suggestion
                ? suggestionText(suggestion, exerciseName)
                : muscle.status === 'none'
                  ? 'No sets yet this week.'
                  : muscle.status === 'optimal'
                    ? 'Right in your target range. Keep it up.'
                    : muscle.status === 'high'
                      ? 'High but recoverable. Watch your recovery.'
                      : muscle.status === 'building'
                        ? 'Above minimum volume. A few more sets would reach your target range.'
                        : 'On track.'}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
