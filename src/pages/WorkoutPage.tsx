import { useState } from 'react';
import HelpButton from '@/components/guide/HelpButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DeloadCard from '@/components/progress/DeloadCard';
import StartFromProgram from '@/components/program/StartFromProgram';
import SessionEditor from '@/components/SessionEditor';
import SummaryStats from '@/components/SummaryStats';
import WorkoutTimer from '@/components/WorkoutTimer';
import StaleSessionPrompt, { isStale } from '@/components/StaleSessionPrompt';
import {
  sessionsRepo,
  useActiveSession,
  useSessionDetail,
  useUnit,
  type SessionSummary,
} from '@/db';
import { isPaused } from '@/lib/workoutTimer';

export default function WorkoutPage() {
  const active = useActiveSession();
  const detail = useSessionDetail(active?.id);
  const unit = useUnit();
  const [finishOpen, setFinishOpen] = useState(false);
  const [done, setDone] = useState<SessionSummary | null>(null);

  if (active === undefined || unit === undefined) {
    return (
      <section className="space-y-4" aria-busy="true">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold">Workout</h1>
          <HelpButton anchor="logging" label="logging a workout" />
        </div>
        <div className="bg-muted h-12 animate-pulse rounded-md" aria-hidden="true" />
      </section>
    );
  }

  if (done) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold">Workout</h1>
          <HelpButton anchor="logging" label="logging a workout" />
        </div>
        <h2 className="text-lg font-medium">Nice work!</h2>
        <SummaryStats summary={done} unit={unit} />
        <Button className="w-full" data-testid="summary-done" onClick={() => setDone(null)}>
          Done
        </Button>
      </section>
    );
  }

  if (!active) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold">Workout</h1>
          <HelpButton anchor="logging" label="logging a workout" />
        </div>
        <Button
          size="lg"
          className="w-full"
          data-testid="start-workout"
          onClick={() => void sessionsRepo.startSession()}
        >
          Start workout
        </Button>
        <StartFromProgram />
        <DeloadCard />
      </section>
    );
  }

  const preview = detail ? sessionsRepo.summarize(detail) : null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-semibold">Workout</h1>
            <HelpButton anchor="logging" label="logging a workout" />
          </div>
          <p className="text-muted-foreground text-xs" data-testid="session-status">
            {isPaused(active) ? 'Paused' : 'In progress'} · started{' '}
            {new Date(active.startedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <WorkoutTimer session={active} />
        </div>
        <Button data-testid="finish-workout" onClick={() => setFinishOpen(true)}>
          Finish
        </Button>
      </div>
      {detail && isStale(active.startedAt) && <StaleSessionPrompt detail={detail} />}
      {detail && <SessionEditor detail={detail} unit={unit} />}
      <Button
        variant="ghost"
        className="text-destructive w-full"
        data-testid="discard-workout"
        onClick={() => {
          if (window.confirm('Discard this workout and all its sets?')) {
            void sessionsRepo.deleteSession(active.id);
          }
        }}
      >
        Discard workout
      </Button>

      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent data-testid="finish-dialog">
          <DialogHeader>
            <DialogTitle>Finish workout?</DialogTitle>
            <DialogDescription>Only completed, non-warm-up sets count.</DialogDescription>
          </DialogHeader>
          {preview && <SummaryStats summary={preview} unit={unit} />}
          <DialogFooter>
            <Button
              data-testid="finish-confirm"
              onClick={async () => {
                const s = await sessionsRepo.finishSession(active.id);
                setFinishOpen(false);
                if (s) setDone(s);
              }}
            >
              Finish workout
            </Button>
            <Button variant="outline" onClick={() => setFinishOpen(false)}>
              Keep going
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
