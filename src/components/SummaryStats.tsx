import type { SessionSummary } from '@/db';
import type { WeightUnit } from '@/lib/units';
import { formatDuration, formatVolume } from '@/lib/weight';

export default function SummaryStats({
  summary,
  unit,
}: {
  summary: SessionSummary;
  unit: WeightUnit;
}) {
  const items = [
    ['Duration', formatDuration(summary.durationMs), 'summary-duration'],
    ['Exercises', String(summary.exerciseCount), 'summary-exercises'],
    ['Working sets', String(summary.workingSets), 'summary-sets'],
    ['Total volume', formatVolume(summary.volumeKg, unit), 'summary-volume'],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-3" data-testid="summary">
      {items.map(([label, value, id]) => (
        <div key={id} className="rounded-lg border p-3">
          <dt className="text-muted-foreground text-xs">{label}</dt>
          <dd className="text-xl font-semibold" data-testid={id}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
