import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sessionsRepo, type Session } from '@/db';
import { activeMs, formatClock, isPaused } from '@/lib/workoutTimer';
import { cn } from '@/lib/utils';

export default function WorkoutTimer({ session }: { session: Session }) {
  const [now, setNow] = useState(Date.now);
  const paused = isPaused(session);

  // While paused the clock reads off `pausedAt`; on resume, catch up at once
  // rather than waiting out the first interval.
  useEffect(() => {
    if (session.pausedAt !== undefined) return;
    const tick = () => setNow(Date.now());
    const catchUp = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(catchUp);
      clearInterval(id);
    };
  }, [session.pausedAt]);

  return (
    <div className="flex items-center gap-2">
      <span
        role="timer"
        data-testid="workout-timer"
        className={cn('text-2xl font-semibold tabular-nums', paused && 'text-muted-foreground')}
      >
        {formatClock(activeMs(session, session.pausedAt ?? now))}
      </span>
      {paused ? (
        <Button
          variant="outline"
          size="icon"
          data-testid="resume-workout"
          aria-label="Resume workout timer"
          onClick={() => void sessionsRepo.resumeSession(session.id)}
        >
          <Play />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="icon"
          data-testid="pause-workout"
          aria-label="Pause workout timer"
          onClick={() => void sessionsRepo.pauseSession(session.id)}
        >
          <Pause />
        </Button>
      )}
    </div>
  );
}
