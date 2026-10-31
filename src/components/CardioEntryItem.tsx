import { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatEstimate } from '@/analyzer/cardio';
import type { CardioProfile } from '@/data/schema';
import { cardioRepo, CARDIO_INTENSITIES, type CardioEntry, type CardioIntensity } from '@/db';
import { parseIntInput } from '@/lib/weight';

const LABELS: Record<CardioIntensity, string> = {
  relaxed: 'Relaxed',
  moderate: 'Moderate',
  hard: 'Hard',
};

interface Props {
  entry: CardioEntry;
  index: number;
  profile: CardioProfile | undefined;
}

export default function CardioEntryItem({ entry, index, profile }: Props) {
  const minutesRef = useRef<HTMLInputElement>(null);
  const minutes = entry.durationSec > 0 ? Math.round(entry.durationSec / 60) : 0;
  const minutesText = minutes > 0 ? String(minutes) : '';

  /** Reads the input into whole-minute seconds; empty or non-numeric is 0. */
  function readDurationSec(): number {
    const n = parseIntInput(minutesRef.current?.value ?? '');
    return n !== undefined && Number.isFinite(n) && n > 0 ? cardioRepo.clampMinutes(n) * 60 : 0;
  }

  function commit() {
    const durationSec = readDurationSec();
    if (durationSec !== entry.durationSec) void cardioRepo.updateEntry(entry.id, { durationSec });
    // Re-sync the uncontrolled input (e.g. "999" shows as the clamped 600).
    if (minutesRef.current) {
      minutesRef.current.value = durationSec > 0 ? String(durationSec / 60) : '';
    }
  }

  function onDone(checked: boolean) {
    const durationSec = readDurationSec();
    if (checked && durationSec <= 0) {
      minutesRef.current?.focus();
      return;
    }
    void cardioRepo.setEntryDone(entry.id, checked, { durationSec });
  }

  const done = entry.completedAt !== undefined;
  const estimate = formatEstimate(profile, entry.intensity, entry.durationSec);

  return (
    <li
      data-testid="cardio-entry"
      data-entry-id={entry.id}
      className={cn('space-y-2 rounded-lg border p-2', done && 'bg-primary/10 border-primary/40')}
    >
      <div className="flex items-center gap-2">
        <Input
          key={`${entry.id}-${minutesText}`}
          ref={minutesRef}
          data-testid="cardio-minutes"
          aria-label={`Entry ${index + 1} minutes`}
          inputMode="numeric"
          placeholder="min"
          defaultValue={minutesText}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="w-20 px-2 text-center"
        />
        <span className="text-muted-foreground text-sm">min</span>
        <div className="flex-1" />
        <Checkbox
          data-testid="cardio-done"
          aria-label={`Entry ${index + 1} done`}
          checked={done}
          onCheckedChange={(c) => onDone(c === true)}
          className="size-11"
        />
        <Button
          variant="ghost"
          size="icon"
          data-testid="cardio-delete"
          aria-label={`Delete entry ${index + 1}`}
          onClick={() => void cardioRepo.deleteEntry(entry.id)}
        >
          <Trash2 />
        </Button>
      </div>
      <div role="group" aria-label="Intensity" className="grid grid-cols-3 gap-1">
        {CARDIO_INTENSITIES.map((it) => (
          <Button
            key={it}
            type="button"
            size="sm"
            variant={entry.intensity === it ? 'default' : 'outline'}
            aria-pressed={entry.intensity === it}
            data-testid={`cardio-intensity-${it}`}
            className="min-h-11"
            onClick={() => void cardioRepo.updateEntry(entry.id, { intensity: it })}
          >
            {LABELS[it]}
          </Button>
        ))}
      </div>
      {estimate && (
        <p data-testid="cardio-estimate" className="text-muted-foreground text-sm">
          {estimate}
        </p>
      )}
    </li>
  );
}
