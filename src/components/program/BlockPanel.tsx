import { useState } from 'react';
import { Minus, Plus, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TRAINING } from '@/config/training';
import { MUSCLES } from '@/data';
import { nameFor, useExerciseLookup } from '@/db/customHooks';
import { useBlockView } from '@/db/blockHooks';
import * as programsRepo from '@/db/programsRepo';
import { defaultRampExerciseIds } from '@/program/block';
import type { Program } from '@/program/types';
import { cn } from '@/lib/utils';
import PlanCheckView from './PlanCheckView';
import { formatSets } from './format';

const muscleName = new Map(MUSCLES.map((m) => [m.id, m.name]));

/** "Run as block" setup, or the running block's week strip with per-week plan check. */
export default function BlockPanel({ program }: { program: Program }) {
  const view = useBlockView(program.id);
  const lookup = useExerciseLookup();
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [weeks, setWeeks] = useState<number>(TRAINING.blocks.defaultWeeks);
  const [ramp, setRamp] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (view === undefined) return null;
  const { minWeeks, maxWeeks } = TRAINING.blocks;
  const exerciseIds = [
    ...new Set(program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId))),
  ];

  if (view === null) {
    const chosen = ramp ?? defaultRampExerciseIds(program);
    const toggle = (id: string, on: boolean) =>
      setRamp(on ? [...chosen, id] : chosen.filter((x) => x !== id));
    return (
      <section className="space-y-3 rounded-lg border p-3" aria-labelledby="block-heading">
        <h2 id="block-heading" className="text-lg font-medium">
          Run as block
        </h2>
        <p className="text-muted-foreground text-sm">
          Ramp sets week to week, then finish with a planned deload week.
        </p>
        <div className="flex items-center gap-2" role="group" aria-label="Block length">
          <Button
            variant="outline"
            size="icon"
            aria-label="Fewer weeks"
            disabled={weeks <= minWeeks}
            onClick={() => setWeeks((w) => Math.max(minWeeks, w - 1))}
          >
            <Minus />
          </Button>
          <span
            className="w-24 text-center text-sm tabular-nums"
            aria-live="polite"
            data-testid="block-weeks"
          >
            {weeks} weeks
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="More weeks"
            disabled={weeks >= maxWeeks}
            onClick={() => setWeeks((w) => Math.min(maxWeeks, w + 1))}
          >
            <Plus />
          </Button>
        </div>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Exercises that ramp</legend>
          {exerciseIds.length === 0 && (
            <p className="text-muted-foreground text-sm">Add exercises to this program first.</p>
          )}
          {exerciseIds.map((id) => {
            const name = nameFor(lookup, id);
            return (
              <label key={id} className="flex min-h-11 items-center gap-3 text-sm">
                <Checkbox
                  checked={chosen.includes(id)}
                  onCheckedChange={(v) => toggle(id, v === true)}
                  aria-label={`Ramp ${name}`}
                />
                <span className="min-w-0 break-words">{name}</span>
              </label>
            );
          })}
        </fieldset>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button
          data-testid="block-start"
          disabled={exerciseIds.length === 0}
          onClick={() =>
            void programsRepo
              .startBlock(program.id, { weeks, rampExerciseIds: chosen })
              .then(() => setError(null))
              .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not start.'))
          }
        >
          Start {weeks}-week block
        </Button>
      </section>
    );
  }

  const { block, currentWeek, projection } = view;
  const shown = selected ?? currentWeek ?? 1;
  const week = projection.weeks[shown - 1] ?? projection.weeks[0];
  const weekWarnings = projection.mrvWarnings.filter((w) => w.week === week.week);
  const status =
    currentWeek === null
      ? 'This block is not running this week (it has not started or has finished). Restart to begin again.'
      : `Week ${currentWeek} of ${block.weeks}${currentWeek === block.weeks ? ', deload' : ''}`;

  return (
    <section
      className="space-y-3 rounded-lg border p-3"
      aria-labelledby="block-heading"
      data-testid="block-panel"
    >
      <h2 id="block-heading" className="text-lg font-medium">
        Block
      </h2>
      <p className="text-sm" role="status" data-testid="block-status">
        {status}
      </p>

      <ol className="flex gap-1 overflow-x-auto" aria-label="Block weeks" data-testid="block-strip">
        {projection.weeks.map((w) => {
          const isCurrent = w.week === currentWeek;
          const hasMrv = projection.mrvWarnings.some((m) => m.week === w.week);
          return (
            <li key={w.week} className="min-w-0 flex-1">
              <button
                type="button"
                data-testid={`block-week-${w.week}`}
                aria-pressed={w.week === shown}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Week ${w.week}${w.deload ? ', deload' : ''}${isCurrent ? ', current' : ''}${hasMrv ? ', over recoverable volume' : ''}`}
                onClick={() => setSelected(w.week)}
                className={cn(
                  'focus-visible:ring-ring flex min-h-11 w-full min-w-11 flex-col items-center justify-center rounded-md border px-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none',
                  isCurrent && 'bg-primary text-primary-foreground border-primary',
                  !isCurrent && w.week === shown && 'bg-secondary',
                )}
              >
                <span>W{w.week}</span>
                {w.deload && <span className="text-[10px] font-normal">Deload</span>}
                {hasMrv && (
                  <span className="text-[10px] font-normal">
                    <TriangleAlert aria-hidden className="inline size-3" /> MRV
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="space-y-2" data-testid="block-week-detail" aria-live="polite">
        <h3 className="font-medium">
          Week {week.week}
          {week.deload ? ' (deload)' : ''}
        </h3>
        {week.deload && week.targetRir && (
          <p className="text-sm">
            Deload: about half the sets, stop {week.targetRir.min}-{week.targetRir.max} reps in
            reserve.
          </p>
        )}
        {weekWarnings.length > 0 && (
          <ul
            className="bg-secondary space-y-1 rounded-lg border p-3 text-sm"
            aria-label="Over recoverable volume"
          >
            {weekWarnings.map((w) => (
              <li key={w.muscleId} data-testid="block-mrv-warning">
                <span className="font-medium">{muscleName.get(w.muscleId) ?? w.muscleId}</span>
                {` gets ${formatSets(w.sets)} sets in week ${w.week}, above the ${w.mrv} you can recover from.`}
              </li>
            ))}
          </ul>
        )}
        <ul className="divide-y rounded-lg border text-sm">
          {program.days.map((d, di) => (
            <li key={d.id} className="px-3 py-2">
              <p className="font-medium">
                Day {di + 1}: {d.name}
              </p>
              <ul className="text-muted-foreground">
                {week.exercises
                  .filter((e) => e.dayId === d.id)
                  .map((e) => (
                    <li key={e.index} className="flex justify-between gap-2">
                      <span className="min-w-0 break-words">{nameFor(lookup, e.exerciseId)}</span>
                      <span className="tabular-nums">{e.sets} sets</span>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
        <PlanCheckView check={week.planCheck} nameFor={(id) => nameFor(lookup, id)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          data-testid="block-restart"
          onClick={() => void programsRepo.restartBlock(program.id)}
        >
          Restart block
        </Button>
        <Button variant="outline" data-testid="block-end" onClick={() => setConfirmEnd(true)}>
          End block
        </Button>
      </div>

      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>End this block?</DialogTitle>
            <DialogDescription>
              Days will go back to the program&apos;s normal set counts. Logged workouts are not
              affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEnd(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              data-testid="confirm-end-block"
              onClick={() => {
                setConfirmEnd(false);
                setSelected(null);
                void programsRepo.endBlock(program.id);
              }}
            >
              End block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
