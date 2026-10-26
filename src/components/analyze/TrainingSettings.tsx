import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DEFAULT_TARGETS } from '@/config/training';
import type { VolumeTarget } from '@/config/training';
import { MUSCLES } from '@/data';
import type { MuscleId } from '@/data';
import { settingsRepo, useTargetOverrides, useWeekStartsOn } from '@/db';
import type { WeekStartDay } from '@/analyzer';

const DAYS: { v: WeekStartDay; label: string }[] = [
  { v: 1, label: 'Monday' },
  { v: 0, label: 'Sunday' },
  { v: 6, label: 'Saturday' },
];

const FIELDS: { k: keyof VolumeTarget; label: string }[] = [
  { k: 'mev', label: 'MEV' },
  { k: 'mavLow', label: 'MAV low' },
  { k: 'mavHigh', label: 'MAV high' },
  { k: 'mrv', label: 'MRV' },
];

export function validateTarget(t: VolumeTarget): string | null {
  const vals = [t.mev, t.mavLow, t.mavHigh, t.mrv];
  if (vals.some((v) => !Number.isFinite(v) || v < 0)) return 'Enter numbers of 0 or more.';
  if (!(t.mev <= t.mavLow && t.mavLow <= t.mavHigh && t.mavHigh <= t.mrv))
    return 'Must satisfy MEV ≤ MAV low ≤ MAV high ≤ MRV.';
  return null;
}

const same = (a: VolumeTarget, b: VolumeTarget) =>
  a.mev === b.mev && a.mavLow === b.mavLow && a.mavHigh === b.mavHigh && a.mrv === b.mrv;

function MuscleTargetEditor({
  id,
  name,
  current,
}: {
  id: MuscleId;
  name: string;
  current: VolumeTarget;
}) {
  const def = DEFAULT_TARGETS[id];
  const [draft, setDraft] = useState<Record<keyof VolumeTarget, string>>(() => ({
    mev: String(current.mev),
    mavLow: String(current.mavLow),
    mavHigh: String(current.mavHigh),
    mrv: String(current.mrv),
  }));
  const [error, setError] = useState<string | null>(null);

  async function save(next: Record<keyof VolumeTarget, string>) {
    const t: VolumeTarget = {
      mev: Number(next.mev),
      mavLow: Number(next.mavLow),
      mavHigh: Number(next.mavHigh),
      mrv: Number(next.mrv),
    };
    const err =
      next.mev === '' || next.mavLow === '' || next.mavHigh === '' || next.mrv === ''
        ? 'Fill in all four values.'
        : validateTarget(t);
    setError(err);
    if (err) return;
    const overrides = { ...(await settingsRepo.getTargetOverrides()) };
    if (same(t, def)) delete overrides[id];
    else overrides[id] = t;
    await settingsRepo.setTargetOverrides(overrides);
  }

  async function reset() {
    const next = {
      mev: String(def.mev),
      mavLow: String(def.mavLow),
      mavHigh: String(def.mavHigh),
      mrv: String(def.mrv),
    };
    setDraft(next);
    setError(null);
    await save(next);
  }

  const isDefault = same(current, def);
  return (
    <li className="space-y-2 p-3" data-testid="target-row" data-muscle-id={id}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{name}</span>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11"
          disabled={isDefault}
          onClick={() => void reset()}
        >
          Reset
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {FIELDS.map(({ k, label }) => (
          <label key={k} className="text-muted-foreground text-xs">
            {label}
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={draft[k]}
              aria-label={`${name} ${label}`}
              aria-invalid={error ? true : undefined}
              placeholder={String(def[k])}
              className="px-2 text-foreground"
              onChange={(e) => {
                const next = { ...draft, [k]: e.target.value };
                setDraft(next);
                void save(next);
              }}
            />
          </label>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Default {def.mev} / {def.mavLow}–{def.mavHigh} / {def.mrv}
      </p>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </li>
  );
}

export default function TrainingSettings() {
  const wso = useWeekStartsOn();
  const overrides = useTargetOverrides();
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Training</h2>
      <label className="block space-y-1 text-sm">
        Week starts on
        <select
          data-testid="week-start"
          value={wso ?? 1}
          onChange={(e) =>
            void settingsRepo.setWeekStartsOn(Number(e.target.value) as WeekStartDay)
          }
          className="border-input bg-background focus-visible:ring-ring/50 h-11 w-full rounded-md border px-3 text-base outline-none focus-visible:ring-[3px]"
        >
          {DAYS.map((d) => (
            <option key={d.v} value={d.v}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <details className="rounded-lg border">
        <summary className="min-h-11 cursor-pointer px-3 py-3 font-medium">
          Weekly volume targets (sets per muscle)
        </summary>
        <p className="text-muted-foreground px-3 pb-2 text-xs">
          MEV = minimum effective, MAV = adaptive range, MRV = max recoverable. Changes save
          automatically when valid.
        </p>
        {overrides && (
          <ul className="divide-border divide-y border-t">
            {MUSCLES.map((m) => (
              <MuscleTargetEditor
                key={`${m.id}-${JSON.stringify(overrides[m.id] ?? null)}`}
                id={m.id}
                name={m.name}
                current={overrides[m.id] ?? DEFAULT_TARGETS[m.id]}
              />
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
