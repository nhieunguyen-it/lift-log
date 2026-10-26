import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useActiveSession } from '@/db';
import * as programsRepo from '@/db/programsRepo';
import { useActiveProgram } from '@/db/programHooks';

/**
 * Workout-tab card: when a program is active and no session is running, one button per day
 * ("Start Day N: <name>"). Always links to /programs.
 */
export default function StartFromProgram() {
  const program = useActiveProgram();
  const active = useActiveSession();
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
      {program && !active && (
        <ul className="space-y-2">
          {program.days.map((d, i) => (
            <li key={d.id}>
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-start"
                data-testid="start-program-day"
                onClick={() => void programsRepo.startProgramDay(program.id, d.id)}
              >
                Start Day {i + 1}: {d.name}
              </Button>
            </li>
          ))}
        </ul>
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
