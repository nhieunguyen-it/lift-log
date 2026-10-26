import { useRef } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WeightUnit } from '@/lib/units';
import { parseIntInput, parseWeightInput, weightInputText } from '@/lib/weight';
import { setsRepo, type SetRow } from '@/db';
import type { SetPatch } from '@/db/setsRepo';

export const SET_GRID = 'grid grid-cols-[2rem_1fr_1fr_4rem_2.75rem] items-center gap-2';

interface Props {
  set: SetRow;
  index: number;
  unit: WeightUnit;
  bodyweight: boolean;
}

const numInput = 'px-2 text-center';

export default function SetRowItem({ set, index, unit, bodyweight }: Props) {
  const weightRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);
  const rirRef = useRef<HTMLInputElement>(null);

  const weightText = weightInputText(set.weightKg, unit);
  const repsText = set.reps > 0 ? String(set.reps) : '';
  const rirText = set.rir === undefined ? '' : String(set.rir);

  /** Reads the three inputs into a patch containing only changed fields. */
  function readPatch(): SetPatch {
    const patch: SetPatch = {};
    if (weightRef.current && weightRef.current.value !== weightText) {
      patch.weightKg = parseWeightInput(weightRef.current.value, unit);
    }
    if (repsRef.current && repsRef.current.value !== repsText) {
      patch.reps = parseIntInput(repsRef.current.value) ?? 0;
    }
    if (rirRef.current && rirRef.current.value !== rirText) {
      patch.rir = parseIntInput(rirRef.current.value);
    }
    return patch;
  }

  function commit() {
    const patch = readPatch();
    if (Object.keys(patch).length > 0) void setsRepo.updateSet(set.id, patch);
  }

  function onDone(checked: boolean) {
    const patch = readPatch();
    const reps = patch.reps ?? set.reps;
    if (checked && reps <= 0) {
      repsRef.current?.focus();
      return;
    }
    void setsRepo.setDone(set.id, checked, patch);
  }

  const done = set.completedAt !== undefined;
  const keyFor = (v: string) => `${set.id}-${unit}-${v}`;
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

  return (
    <li
      data-testid="set-row"
      data-set-id={set.id}
      className={cn('rounded-lg border p-2', done && 'bg-primary/10 border-primary/40')}
    >
      <div className={SET_GRID}>
        <span
          className={cn(
            'text-center text-sm font-medium',
            set.isWarmup ? 'text-amber-500' : 'text-muted-foreground',
          )}
        >
          {set.isWarmup ? 'W' : index + 1}
        </span>
        <Input
          key={keyFor(weightText)}
          ref={weightRef}
          data-testid="weight-input"
          aria-label={`Set ${index + 1} ${bodyweight ? 'added weight' : 'weight'} (${unit})`}
          inputMode="decimal"
          placeholder={bodyweight ? `+${unit}` : unit}
          defaultValue={weightText}
          onBlur={commit}
          onKeyDown={onEnter}
          className={numInput}
        />
        <Input
          key={keyFor(`r${repsText}`)}
          ref={repsRef}
          data-testid="reps-input"
          aria-label={`Set ${index + 1} reps`}
          inputMode="numeric"
          placeholder="reps"
          defaultValue={repsText}
          onBlur={commit}
          onKeyDown={onEnter}
          className={numInput}
        />
        <Input
          key={keyFor(`i${rirText}`)}
          ref={rirRef}
          data-testid="rir-input"
          aria-label={`Set ${index + 1} RIR`}
          inputMode="numeric"
          placeholder="RIR"
          defaultValue={rirText}
          onBlur={commit}
          onKeyDown={onEnter}
          className={numInput}
        />
        <Checkbox
          data-testid="done-checkbox"
          aria-label={`Set ${index + 1} done`}
          checked={done}
          onCheckedChange={(c) => onDone(c === true)}
          className="size-11"
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            data-testid="warmup-checkbox"
            aria-label={`Set ${index + 1} warm-up`}
            checked={set.isWarmup}
            onCheckedChange={(c) => void setsRepo.updateSet(set.id, { isWarmup: c === true })}
          />
          Warm-up
        </label>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            data-testid="duplicate-set"
            aria-label={`Duplicate set ${index + 1}`}
            onClick={() => void setsRepo.duplicateSet(set.id)}
          >
            <Copy />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            data-testid="delete-set"
            aria-label={`Delete set ${index + 1}`}
            onClick={() => void setsRepo.deleteSet(set.id)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </li>
  );
}
