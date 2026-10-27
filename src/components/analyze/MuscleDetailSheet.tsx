import { Suspense, lazy, useState } from 'react';
import { PlusCircle, Repeat2 } from 'lucide-react';
import type { AnalyzerResult, MuscleWeek } from '@/analyzer';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AlternativesList from '@/components/recommend/AlternativesList';
import type { VolumeSuggestion } from '@/recommend';
import { contributionBars } from './analyzeModel';
import { fmtSets, muscleName } from './muscleSort';
import Sparkline from './Sparkline';
import StatusBadge from './StatusBadge';
import { CHART, STATUS_HINT } from './statusStyle';

const VolumeTrendChart = lazy(() => import('@/components/progress/VolumeTrendChart'));

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

function statusNote(muscle: MuscleWeek): string {
  switch (muscle.status) {
    case 'none':
      return 'No sets yet this week.';
    case 'optimal':
      return 'Right in your target range. Keep it up.';
    case 'high':
      return 'High but recoverable. Watch your recovery.';
    case 'building':
      return 'Above minimum volume. A few more sets would reach your target range.';
    default:
      return 'On track.';
  }
}

function Body({
  muscle,
  trend,
  suggestion,
  exerciseName,
}: Omit<Props, 'muscle' | 'onClose'> & { muscle: MuscleWeek }) {
  const [panel, setPanel] = useState<'add' | 'swap' | null>(null);
  const bars = contributionBars(muscle.contributions);
  const [swapId, setSwapId] = useState<string | undefined>(bars[0]?.exerciseId);
  const toggle = (p: 'add' | 'swap') => setPanel((cur) => (cur === p ? null : p));

  return (
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

      <section className="space-y-1" aria-labelledby="detail-contrib-h">
        <h3 id="detail-contrib-h" className="font-medium">
          Contributing exercises
        </h3>
        {bars.length === 0 ? (
          <p className="text-muted-foreground text-sm">No sets logged this week.</p>
        ) : (
          <ul className="space-y-1.5 text-sm" data-testid="contributions">
            {bars.map((c) => {
              const w = c.sets > 0 ? c.weightedSets / c.sets : 0;
              return (
                <li key={c.exerciseId}>
                  <div className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{exerciseName(c.exerciseId)}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {fmtSets(c.sets)} sets × {Math.round(w * 100) / 100} ={' '}
                      {c.weightedSets.toFixed(1)} ({Math.round(c.pct)}%)
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full"
                    style={{ backgroundColor: CHART.track }}
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${c.pct}%`, backgroundColor: CHART.line }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {trend && (
        <section className="space-y-1" aria-labelledby="detail-trend-h">
          <h3 id="detail-trend-h" className="font-medium">
            Last {trend.length} weeks
          </h3>
          <Sparkline points={trend} mev={muscle.target.mev} label={muscleName(muscle.muscleId)} />
          <Suspense
            fallback={
              <div
                className="bg-muted h-32 animate-pulse rounded-md motion-reduce:animate-none"
                aria-hidden="true"
              />
            }
          >
            <VolumeTrendChart muscleId={muscle.muscleId} />
          </Suspense>
        </section>
      )}

      <p className="bg-muted rounded-md p-3 text-sm" data-testid="detail-suggestion">
        {suggestion ? suggestionText(suggestion, exerciseName) : statusNote(muscle)}
      </p>

      <div className="flex gap-2" role="group" aria-label="Quick actions">
        <Button
          variant="outline"
          className="min-h-11 flex-1"
          aria-expanded={panel === 'add'}
          data-testid="action-add-sets"
          onClick={() => toggle('add')}
        >
          <PlusCircle aria-hidden="true" /> Add sets
        </Button>
        <Button
          variant="outline"
          className="min-h-11 flex-1"
          aria-expanded={panel === 'swap'}
          disabled={bars.length === 0}
          data-testid="action-swap"
          onClick={() => toggle('swap')}
        >
          <Repeat2 aria-hidden="true" /> Swap
        </Button>
      </div>

      {panel === 'add' && (
        <div className="space-y-1 text-sm" data-testid="panel-add-sets">
          {suggestion && suggestion.kind === 'add' ? (
            <>
              <p className="font-medium">
                Add {suggestion.setsToAdd} set{suggestion.setsToAdd === 1 ? '' : 's'} with:
              </p>
              <ul className="list-disc pl-5">
                {suggestion.exercises.map((e) => (
                  <li key={e.exerciseId}>{exerciseName(e.exerciseId)}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-muted-foreground">
              No extra sets suggested for {muscleName(muscle.muscleId).toLowerCase()} this week.
            </p>
          )}
        </div>
      )}

      {panel === 'swap' && swapId && (
        <div className="space-y-2" data-testid="panel-swap">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Swap</span>
            <select
              value={swapId}
              onChange={(e) => setSwapId(e.target.value)}
              className="border-input bg-background min-h-11 min-w-0 flex-1 rounded-md border px-2"
            >
              {bars.map((b) => (
                <option key={b.exerciseId} value={b.exerciseId}>
                  {exerciseName(b.exerciseId)}
                </option>
              ))}
            </select>
          </label>
          <AlternativesList exerciseId={swapId} />
        </div>
      )}
    </>
  );
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
          <Body
            key={muscle.muscleId}
            muscle={muscle}
            trend={trend}
            suggestion={suggestion}
            exerciseName={exerciseName}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
