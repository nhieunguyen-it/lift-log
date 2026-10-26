import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { exercises } from '@/data';
import { dismissDeload, useDeloadSignal } from '@/db/progressHooks';
import type { DeloadSignal } from '@/recommend';

const NAMES = new Map(exercises.map((e) => [e.id, e.name]));

interface Props {
  /** Test/preview override; normally read live from the database. */
  signal?: DeloadSignal | null;
  onDismiss?: (key: string) => void;
}

const rirText = (r: { min: number; max: number }) =>
  r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;

/** Suggests (never applies) a deload week. Renders nothing when there is no signal. */
export default function DeloadCard({ signal: override, onDismiss }: Props) {
  const live = useDeloadSignal();
  const signal = override !== undefined ? override : live;
  if (!signal || !signal.overall) return null;
  const pctKept = Math.round(signal.setsFraction * 100);
  return (
    <Card data-testid="deload-card" role="region" aria-label="Deload suggestion">
      <CardHeader>
        <CardTitle>Consider a deload week</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="space-y-1">
          {signal.exercises.map((e) => (
            <li key={e.exerciseId}>
              <span className="font-medium">{NAMES.get(e.exerciseId) ?? e.exerciseId}</span>
              <span className="text-muted-foreground">: {e.detail}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          Next week, keep the same exercises but do about {pctKept}% of your usual sets, stopping
          with {rirText(signal.targetRir)} reps in reserve. This is only a suggestion; nothing in
          your log or plan changes.
        </p>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => {
            if (onDismiss) onDismiss(signal.key);
            else void dismissDeload(signal.key);
          }}
        >
          Dismiss
        </Button>
      </CardContent>
    </Card>
  );
}
