import { Button } from '@/components/ui/button';
import { TRAINING } from '@/config/training';
import { sessionsRepo, type SessionDetail } from '@/db';

/** True when an unfinished session started longer ago than the stale threshold. */
export function isStale(startedAt: number, now = Date.now()): boolean {
  return now - startedAt > TRAINING.staleSessionMs;
}

/** End time for a stale session: its last completed set, else its start. */
export function staleFinishTime(detail: SessionDetail): number {
  let end = detail.session.startedAt;
  for (const e of detail.exercises) {
    for (const s of e.sets) {
      if (s.completedAt !== undefined && s.completedAt > end) end = s.completedAt;
    }
  }
  return end;
}

interface Props {
  detail: SessionDetail;
  onFinished?: () => void;
}

export default function StaleSessionPrompt({ detail, onFinished }: Props) {
  const id = detail.session.id;
  const started = new Date(detail.session.startedAt).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div
      role="alert"
      data-testid="stale-session"
      className="border-destructive/50 bg-card space-y-3 rounded-xl border-2 p-4"
    >
      <div>
        <p className="font-semibold">This workout is still open</p>
        <p className="text-muted-foreground text-sm">
          It was started {started}. Finish it at the time of your last completed set, or discard it.
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          data-testid="stale-finish"
          onClick={async () => {
            await sessionsRepo.finishSession(id, staleFinishTime(detail));
            onFinished?.();
          }}
        >
          Finish it
        </Button>
        <Button
          variant="outline"
          className="text-destructive flex-1"
          data-testid="stale-discard"
          onClick={() => {
            if (window.confirm('Discard this workout and all its sets?')) {
              void sessionsRepo.deleteSession(id);
            }
          }}
        >
          Discard it
        </Button>
      </div>
    </div>
  );
}
