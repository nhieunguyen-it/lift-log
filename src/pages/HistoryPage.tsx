import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import SessionEditor from '@/components/SessionEditor';
import SummaryStats from '@/components/SummaryStats';
import { sessionsRepo, useHistory, useSessionDetail, useUnit } from '@/db';
import { formatDuration, formatVolume } from '@/lib/weight';

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export function HistoryPage() {
  const items = useHistory();
  const unit = useUnit();
  if (!items || !unit) return null;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">History</h1>
      {items.length === 0 && (
        <p className="text-muted-foreground text-sm">No finished workouts yet.</p>
      )}
      <ul className="space-y-3">
        {items.map(({ session, summary, exerciseNames }) => (
          <li key={session.id}>
            <Link
              to={`/history/${session.id}`}
              data-testid="history-item"
              className="block rounded-xl focus-visible:ring-[3px] focus-visible:outline-none"
            >
              <Card className="gap-1 py-3">
                <CardContent>
                  <p className="font-semibold">{fmtDate(session.startedAt)}</p>
                  <p className="text-muted-foreground text-sm">
                    {formatDuration(summary.durationMs)} · {summary.workingSets} sets ·{' '}
                    {formatVolume(summary.volumeKg, unit)}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {exerciseNames.join(', ') || 'No exercises'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HistoryDetailPage() {
  const { id } = useParams();
  const detail = useSessionDetail(id);
  const unit = useUnit();
  const navigate = useNavigate();
  if (detail === undefined || unit === undefined) return null;
  if (detail === null) {
    return (
      <section className="space-y-4">
        <p>Workout not found.</p>
        <Link to="/history" className="underline">
          Back to history
        </Link>
      </section>
    );
  }
  return (
    <section className="space-y-4" data-testid="history-detail">
      <Link
        to="/history"
        className="text-muted-foreground inline-flex min-h-11 items-center text-sm"
      >
        <ChevronLeft className="size-4" /> Back
      </Link>
      <h1 className="text-2xl font-semibold">{fmtDate(detail.session.startedAt)}</h1>
      <SummaryStats summary={sessionsRepo.summarize(detail)} unit={unit} />
      <SessionEditor detail={detail} unit={unit} />
      <Button
        variant="ghost"
        className="text-destructive w-full"
        data-testid="delete-session"
        onClick={() => {
          if (window.confirm('Delete this workout permanently?')) {
            void sessionsRepo.deleteSession(detail.session.id).then(() => navigate('/history'));
          }
        }}
      >
        Delete workout
      </Button>
    </section>
  );
}

export default HistoryPage;
