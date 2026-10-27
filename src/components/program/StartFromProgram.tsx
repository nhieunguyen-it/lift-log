import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useActiveSession } from '@/db';
import * as programsRepo from '@/db/programsRepo';
import { useActiveProgram } from '@/db/programHooks';
import { useBlockView } from '@/db/blockHooks';

/**
 * Workout-tab card: when a program is active and no session is running, one button per day
 * ("Start Day N: <name>"). Always links to /programs.
 */
export default function StartFromProgram() {
  const program = useActiveProgram();
  const active = useActiveSession();
  const blockView = useBlockView(program?.id);
  const [error, setError] = useState<string | null>(null);
  if (program === undefined || active === undefined) return null;

  return (
    <section
      className="space-y-2"
      aria-labelledby="start-from-program-heading"
      data-testid="start-from-program"
    >
      <h2 id="start-from-program-heading" className="text-lg font-medium">
        {program ? program.name : 'Programs'}
      </h2>
      {program && blockView?.currentWeek != null && (
        <p className="text-sm" data-testid="start-block-week">
          Block week {blockView.currentWeek} of {blockView.block.weeks}
          {blockView.currentWeek === blockView.block.weeks ? ' (deload)' : ''}
        </p>
      )}
      {program && !active && (
        <ul className="space-y-2">
          {program.days.map((d, i) => (
            <li key={d.id}>
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-start"
                data-testid="start-program-day"
                onClick={() => {
                  setError(null);
                  programsRepo
                    .startProgramDay(program.id, d.id)
                    .catch((e: unknown) =>
                      setError(e instanceof Error ? e.message : 'Could not start this day.'),
                    );
                }}
              >
                Start Day {i + 1}: {d.name}
              </Button>
              {blockView?.currentWeek != null && (
                <p className="text-muted-foreground px-1 text-xs" data-testid="start-day-sets">
                  {blockView.projection.weeks[blockView.currentWeek - 1].exercises
                    .filter((e) => e.dayId === d.id)
                    .reduce((n, e) => n + e.sets, 0)}{' '}
                  sets this week
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {!program && (
        <p className="text-muted-foreground text-sm">
          Pick a weekly plan to start workouts from it.
        </p>
      )}
      <Link
        to="/programs"
        className="text-primary inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
        data-testid="manage-programs"
      >
        Manage programs
      </Link>
    </section>
  );
}
