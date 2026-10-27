import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Minus,
  Plus,
  Repeat2,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ExercisePicker from '@/components/ExercisePicker';
import { CustomBadge } from '@/components/custom';
import { TRAINING } from '@/config/training';
import { nameFor, useExerciseLookup } from '@/db/customHooks';
import { useEquipment } from '@/db/hooks';
import {
  useActiveProgram as useActiveProgramHook,
  usePlanCheck,
  useProgram,
} from '@/db/programHooks';
import * as programsRepo from '@/db/programsRepo';
import * as edit from '@/program/edit';
import type { Program, ProgramExercise } from '@/program/types';
import BlockPanel from './BlockPanel';
import CommitInput from './CommitInput';
import PlanCheckView from './PlanCheckView';
import ProgramSwapDialog from './ProgramSwapDialog';

interface Props {
  programId: string;
}

interface SwapTarget {
  dayId: string;
  index: number;
  exerciseId: string;
}

export default function ProgramEditor({ programId }: Props) {
  const program = useProgram(programId);
  const check = usePlanCheck(programId);
  const equipment = useEquipment();
  const lookup = useExerciseLookup();
  const navigate = useNavigate();
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [swap, setSwap] = useState<SwapTarget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const activeId = useActiveProgramId();

  if (program === undefined) {
    return <div className="bg-muted h-24 animate-pulse rounded-md" aria-busy="true" />;
  }
  if (program === null) {
    return <p className="text-muted-foreground py-6 text-center text-sm">Program not found.</p>;
  }

  const readOnly = program.builtIn;
  const isActive = activeId === program.id;
  const update = (fn: (p: Program) => Program) => void programsRepo.updateProgram(program.id, fn);

  async function duplicateAndEdit() {
    const copy = await programsRepo.duplicateProgram(program!.id);
    void navigate(`/programs/${copy.id}`);
  }

  function flagged(pe: ProgramExercise): boolean {
    const ex = lookup?.get(pe.exerciseId);
    return !!ex && !!equipment && !equipment.includes(ex.equipment);
  }

  return (
    <div className="space-y-5" data-testid="program-editor">
      <div className="space-y-2">
        {readOnly ? (
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{program.name}</h2>
            <Badge variant="secondary">Built-in</Badge>
          </div>
        ) : (
          <label className="block space-y-1">
            <span className="text-sm font-medium">Program name</span>
            <CommitInput
              data-testid="program-name"
              value={program.name}
              maxLength={60}
              onCommit={(v) => v.trim() && update((p) => edit.renameProgram(p, v.trim()))}
            />
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={isActive ? 'secondary' : 'default'}
            data-testid="activate-program"
            aria-pressed={isActive}
            onClick={() => void programsRepo.activateProgram(isActive ? null : program.id)}
          >
            {isActive ? 'Active (tap to deactivate)' : 'Set as active'}
          </Button>
          {readOnly ? (
            <Button
              variant="outline"
              data-testid="edit-builtin"
              onClick={() => void duplicateAndEdit()}
            >
              <Copy /> Edit a copy
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                data-testid="duplicate-program"
                onClick={() => void programsRepo.duplicateProgram(program.id)}
              >
                <Copy /> Duplicate
              </Button>
              <Button
                variant="outline"
                data-testid="delete-program"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 /> Delete
              </Button>
            </>
          )}
        </div>
        {readOnly && (
          <p className="text-muted-foreground text-sm">
            Built-in programs are read-only. Edit a copy to change them.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {program.days.map((day, di) => (
          <Card key={day.id} data-testid="program-day">
            <CardContent className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  {readOnly ? (
                    <h3 className="font-medium">
                      Day {di + 1}: {day.name}
                    </h3>
                  ) : (
                    <label className="block space-y-1">
                      <span className="text-muted-foreground text-xs">Day {di + 1} name</span>
                      <CommitInput
                        data-testid="day-name"
                        value={day.name}
                        maxLength={40}
                        onCommit={(v) =>
                          v.trim() && update((p) => edit.renameDay(p, day.id, v.trim()))
                        }
                      />
                    </label>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move day ${di + 1} up`}
                      disabled={di === 0}
                      onClick={() => update((p) => edit.moveDay(p, day.id, 'up'))}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move day ${di + 1} down`}
                      disabled={di === program.days.length - 1}
                      onClick={() => update((p) => edit.moveDay(p, day.id, 'down'))}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove day ${di + 1}`}
                      data-testid="remove-day"
                      onClick={() => update((p) => edit.removeDay(p, day.id))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>

              {day.exercises.length === 0 && (
                <p className="text-muted-foreground text-sm">No exercises yet.</p>
              )}
              <ul className="space-y-2">
                {day.exercises.map((pe, i) => {
                  const name = nameFor(lookup, pe.exerciseId);
                  const ex = lookup?.get(pe.exerciseId);
                  const flag = flagged(pe);
                  return (
                    <li
                      key={`${pe.exerciseId}-${i}`}
                      className="space-y-2 rounded-lg border p-2"
                      data-testid="program-exercise"
                      data-exercise-id={pe.exerciseId}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium break-words">{name}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {ex?.isCustom && <CustomBadge />}
                            {ex && <Badge variant="outline">{ex.equipment}</Badge>}
                            {flag && (
                              <Badge variant="destructive" data-testid="equipment-flag">
                                <TriangleAlert aria-hidden className="size-3" />
                                Not in your equipment
                              </Badge>
                            )}
                          </div>
                        </div>
                        {!readOnly && (
                          <div className="flex shrink-0">
                            {flag && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Swap ${name}`}
                                data-testid="swap-exercise"
                                onClick={() =>
                                  setSwap({ dayId: day.id, index: i, exerciseId: pe.exerciseId })
                                }
                              >
                                <Repeat2 />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Move ${name} up`}
                              disabled={i === 0}
                              onClick={() => update((p) => edit.moveExercise(p, day.id, i, 'up'))}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Move ${name} down`}
                              disabled={i === day.exercises.length - 1}
                              onClick={() => update((p) => edit.moveExercise(p, day.id, i, 'down'))}
                            >
                              <ArrowDown />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${name}`}
                              data-testid="remove-exercise"
                              onClick={() => update((p) => edit.removeExercise(p, day.id, i))}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        {readOnly ? (
                          <p className="text-sm">
                            {pe.targetSets} sets
                            {pe.repRange && `, ${pe.repRange.min}-${pe.repRange.max} reps`}
                          </p>
                        ) : (
                          <>
                            <div
                              className="flex items-center gap-1"
                              role="group"
                              aria-label={`Sets for ${name}`}
                            >
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label={`Fewer sets for ${name}`}
                                disabled={pe.targetSets <= edit.MIN_TARGET_SETS}
                                onClick={() =>
                                  update((p) => edit.setTargetSets(p, day.id, i, pe.targetSets - 1))
                                }
                              >
                                <Minus />
                              </Button>
                              <span
                                className="w-16 text-center text-sm tabular-nums"
                                data-testid="target-sets"
                                aria-live="polite"
                              >
                                {pe.targetSets} sets
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label={`More sets for ${name}`}
                                disabled={pe.targetSets >= edit.MAX_TARGET_SETS}
                                onClick={() =>
                                  update((p) => edit.setTargetSets(p, day.id, i, pe.targetSets + 1))
                                }
                              >
                                <Plus />
                              </Button>
                            </div>
                            <RepRangeFields
                              name={name}
                              range={pe.repRange}
                              onChange={(r) => update((p) => edit.setRepRange(p, day.id, i, r))}
                            />
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {!readOnly && (
                <Button
                  variant="outline"
                  className="w-full"
                  data-testid="add-program-exercise"
                  onClick={() => setPickerDay(day.id)}
                >
                  <Plus /> Add exercise
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {!readOnly && (
          <Button
            variant="outline"
            className="w-full"
            data-testid="add-day"
            onClick={() => void programsRepo.addDayToProgram(program.id)}
          >
            <Plus /> Add day
          </Button>
        )}
      </div>

      <BlockPanel program={program} />

      {check && <PlanCheckView check={check} nameFor={(id) => nameFor(lookup, id)} />}

      <ExercisePicker
        open={pickerDay !== null}
        onOpenChange={(o) => !o && setPickerDay(null)}
        onPick={(exerciseId) => {
          const dayId = pickerDay;
          if (dayId)
            update((p) =>
              edit.addExercise(p, dayId, exerciseId, TRAINING.programs.defaultTargetSets),
            );
        }}
      />
      <ProgramSwapDialog
        exerciseId={swap?.exerciseId ?? null}
        onClose={() => setSwap(null)}
        onPick={(newId) => {
          if (swap)
            void programsRepo.swapProgramExercise(program.id, swap.dayId, swap.index, newId);
        }}
      />
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Delete {program.name}?</DialogTitle>
            <DialogDescription>Logged workouts are not affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              data-testid="confirm-delete-program"
              onClick={() => {
                setConfirmDelete(false);
                void programsRepo.deleteProgram(program.id).then(() => navigate('/programs'));
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RepRangeFields({
  name,
  range,
  onChange,
}: {
  name: string;
  range: ProgramExercise['repRange'];
  onChange: (r: ProgramExercise['repRange']) => void;
}) {
  const [other, setOther] = useState<{ min?: string; max?: string }>({});
  const min = other.min ?? (range ? String(range.min) : '');
  const max = other.max ?? (range ? String(range.max) : '');
  function commit(nextMin: string, nextMax: string) {
    if (nextMin === '' && nextMax === '') {
      setOther({});
      if (range) onChange(undefined);
      return;
    }
    const a = Number(nextMin);
    const b = Number(nextMax);
    if (
      nextMin !== '' &&
      nextMax !== '' &&
      Number.isInteger(a) &&
      Number.isInteger(b) &&
      a >= 1 &&
      b >= a
    ) {
      setOther({});
      onChange({ min: a, max: b });
    } else {
      setOther({ min: nextMin, max: nextMax });
    }
  }
  const invalid = other.min !== undefined || other.max !== undefined;
  return (
    <fieldset className="flex items-center gap-1" aria-label={`Rep range for ${name}`}>
      <CommitInput
        type="number"
        inputMode="numeric"
        className="w-16"
        placeholder="Reps"
        aria-label={`Min reps for ${name}`}
        aria-invalid={invalid || undefined}
        value={min}
        onCommit={(v) => commit(v, max)}
      />
      <span aria-hidden>-</span>
      <CommitInput
        type="number"
        inputMode="numeric"
        className="w-16"
        placeholder="Reps"
        aria-label={`Max reps for ${name}`}
        aria-invalid={invalid || undefined}
        value={max}
        onCommit={(v) => commit(min, v)}
      />
      <span className="text-muted-foreground text-xs">
        {invalid ? 'Min-max' : range ? '' : 'default'}
      </span>
    </fieldset>
  );
}

function useActiveProgramId(): string | null | undefined {
  const active = useActiveProgramHook();
  return active === undefined ? undefined : (active?.id ?? null);
}
