import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sessionsRepo, type Session } from '@/db';
import { activeMs, formatClock, isPaused } from '@/lib/workoutTimer';
import { cn } from '@/lib/utils';

export default function WorkoutTimer({ session }: { session: Session }) {
  const [now, setNow] = useState(Date.now);
  const paused = isPaused(session);

  // Ticks only while running. The parent keys this component on the pause
  // state, so a resume remounts it with a fresh `now`.
  useEffect(() => {
    if (session.pausedAt !== undefined) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
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
