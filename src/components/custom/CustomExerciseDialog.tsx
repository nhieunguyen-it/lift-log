import { useId, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EQUIPMENT } from '@/data/schema';
import type { MuscleId } from '@/data';
import { useExerciseDetail, useMuscles } from '@/db';
import {
  CustomExerciseValidationError,
  createCustomExercise,
  deleteCustomExercise,
  parseCustomExerciseInput,
  updateCustomExercise,
  type CustomExerciseInput,
} from '@/db/customExercisesRepo';
import { useLoggedSetCount } from '@/db/customHooks';

const selectClass =
  'border-input bg-background h-11 w-full rounded-md border px-3 text-base md:text-sm';

const WEIGHTS = [
  { v: 1, label: 'Primary' },
  { v: 0.75, label: '75%' },
  { v: 0.5, label: '50%' },
  { v: 0.25, label: '25%' },
];

const FORCES = ['push', 'pull', 'legs', 'static'] as const;

interface MuscleRow {
  key: number;
  muscleId: string;
  weight: number;
}

interface Props {
  open: boolean;
  /** Existing custom exercise id to edit, or null to create. */
  exerciseId: string | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
  onDeleted?: () => void;
}

interface Initial {
  name: string;
  equipment: string;
  force: string;
  mechanic: string;
  isBodyweight: boolean;
  minReps: string;
  maxReps: string;
  rows: MuscleRow[];
}

const EMPTY: Initial = {
  name: '',
  equipment: 'dumbbell',
  force: 'push',
  mechanic: 'compound',
  isBodyweight: false,
  minReps: '',
  maxReps: '',
  rows: [{ key: 0, muscleId: '', weight: 1 }],
};

/** Mounts the form only while open (and, when editing, once the exercise has loaded). */
export default function CustomExerciseDialog(props: Props) {
  const { open, exerciseId } = props;
  const detail = useExerciseDetail(exerciseId ?? undefined);
  if (!open) return null;
  if (exerciseId === null) return <Form key="new" {...props} initial={EMPTY} />;
  if (!detail?.exercise) return null;
  const ex = detail.exercise;
  const initial: Initial = {
    name: ex.name,
    equipment: ex.equipment,
    force: ex.force,
    mechanic: ex.mechanic,
    isBodyweight: ex.isBodyweight,
    minReps: ex.repRange ? String(ex.repRange.min) : '',
    maxReps: ex.repRange ? String(ex.repRange.max) : '',
    rows: detail.muscles.map((m, i) => ({ key: i, muscleId: m.muscleId, weight: m.weight })),
  };
  return <Form key={exerciseId} {...props} initial={initial} />;
}

function Form({
  open,
  exerciseId,
  onClose,
  onSaved,
  onDeleted,
  initial,
}: Props & { initial: Initial }) {
  const uid = useId();
  const muscles = useMuscles();
  const loggedSets = useLoggedSetCount(exerciseId ?? undefined);
  const [name, setName] = useState(initial.name);
  const [equipment, setEquipment] = useState(initial.equipment);
  const [force, setForce] = useState(initial.force);
  const [mechanic, setMechanic] = useState(initial.mechanic);
  const [isBodyweight, setIsBodyweight] = useState(initial.isBodyweight);
  const [minReps, setMinReps] = useState(initial.minReps);
  const [maxReps, setMaxReps] = useState(initial.maxReps);
  const [rows, setRows] = useState<MuscleRow[]>(initial.rows);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  function buildInput(): CustomExerciseInput {
    const hasRange = minReps.trim() !== '' || maxReps.trim() !== '';
    return parseCustomExerciseInput({
      name,
      equipment,
      force,
      mechanic,
      isBodyweight,
      ...(hasRange ? { repRange: { min: Number(minReps), max: Number(maxReps) } } : {}),
      muscles: rows
        .filter((r) => r.muscleId !== '')
        .map((r) => ({ muscleId: r.muscleId as MuscleId, weight: r.weight })),
    });
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const input = buildInput();
      const id = exerciseId ?? (await createCustomExercise(input));
      if (exerciseId) await updateCustomExercise(exerciseId, input);
      onSaved?.(id);
      onClose();
    } catch (e) {
      setError(
        e instanceof CustomExerciseValidationError || e instanceof Error
          ? e.message
          : 'Could not save.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!exerciseId) return;
    setBusy(true);
    try {
      await deleteCustomExercise(exerciseId);
      onDeleted?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.');
    } finally {
      setBusy(false);
    }
  }

  const setRow = (key: number, patch: Partial<MuscleRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const id = (s: string) => `${uid}-${s}`;
  const hasHistory = (loggedSets ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-dvh overflow-y-auto"
        data-testid="custom-exercise-dialog"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>{exerciseId ? 'Edit exercise' : 'New exercise'}</DialogTitle>
          <DialogDescription className="sr-only">
            Name, equipment, rep range and the muscles this exercise trains.
          </DialogDescription>
        </DialogHeader>

        {confirmDelete ? (
          <div className="space-y-3" data-testid="custom-delete-confirm">
            <p className="text-sm">
              {hasHistory
                ? `This exercise has ${loggedSets} logged set${loggedSets === 1 ? '' : 's'}. It will be removed from the exercise list, but your history keeps it and it still counts toward your volume.`
                : 'Delete this exercise? This cannot be undone.'}
            </p>
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={busy}
                data-testid="custom-delete-confirm-button"
                onClick={() => void remove()}
              >
                Delete exercise
              </Button>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="space-y-1">
              <label htmlFor={id('name')} className="text-sm font-medium">
                Name
              </label>
              <Input
                id={id('name')}
                data-testid="custom-name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor={id('equipment')} className="text-sm font-medium">
                  Equipment
                </label>
                <select
                  id={id('equipment')}
                  data-testid="custom-equipment"
                  className={selectClass}
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                >
                  {EQUIPMENT.map((eq) => (
                    <option key={eq} value={eq}>
                      {eq}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor={id('force')} className="text-sm font-medium">
                  Force
                </label>
                <select
                  id={id('force')}
                  data-testid="custom-force"
                  className={selectClass}
                  value={force}
                  onChange={(e) => setForce(e.target.value)}
                >
                  {FORCES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor={id('mechanic')} className="text-sm font-medium">
                  Mechanic
                </label>
                <select
                  id={id('mechanic')}
                  data-testid="custom-mechanic"
                  className={selectClass}
                  value={mechanic}
                  onChange={(e) => setMechanic(e.target.value)}
                >
                  <option value="compound">compound</option>
                  <option value="isolation">isolation</option>
                </select>
              </div>
              <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium">
                <input
                  type="checkbox"
                  data-testid="custom-bodyweight"
                  className="size-5"
                  checked={isBodyweight}
                  onChange={(e) => setIsBodyweight(e.target.checked)}
                />
                Bodyweight
              </label>
            </div>

            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">Rep range (optional)</legend>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  aria-label="Minimum reps"
                  data-testid="custom-rep-min"
                  inputMode="numeric"
                  placeholder="Min"
                  value={minReps}
                  onChange={(e) => setMinReps(e.target.value)}
                />
                <Input
                  aria-label="Maximum reps"
                  data-testid="custom-rep-max"
                  inputMode="numeric"
                  placeholder="Max"
                  value={maxReps}
                  onChange={(e) => setMaxReps(e.target.value)}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Leave empty to use the default for the exercise type.
              </p>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Muscles trained</legend>
              <p className="text-muted-foreground text-xs">
                Exactly one primary muscle at 100%; others between 25% and 75%.
              </p>
              {rows.map((r, i) => (
                <div
                  key={r.key}
                  className="flex items-center gap-2"
                  data-testid="custom-muscle-row"
                >
                  <select
                    aria-label={`Muscle ${i + 1}`}
                    className={selectClass}
                    value={r.muscleId}
                    onChange={(e) => setRow(r.key, { muscleId: e.target.value })}
                  >
                    <option value="">Choose muscle</option>
                    {(muscles ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Muscle ${i + 1} weight`}
                    className={selectClass}
                    value={r.weight}
                    onChange={(e) => setRow(r.key, { weight: Number(e.target.value) })}
                  >
                    {WEIGHTS.map((w) => (
                      <option key={w.v} value={w.v}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove muscle ${i + 1}`}
                    disabled={rows.length === 1}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="custom-add-muscle"
                onClick={() =>
                  setRows((rs) => [
                    ...rs,
                    { key: Math.max(...rs.map((x) => x.key)) + 1, muscleId: '', weight: 0.5 },
                  ])
                }
              >
                <Plus /> Add muscle
              </Button>
            </fieldset>

            {error && (
              <p role="alert" data-testid="custom-error" className="text-destructive text-sm">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={busy} data-testid="custom-save">
                {exerciseId ? 'Save changes' : 'Create exercise'}
              </Button>
              {exerciseId && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  data-testid="custom-delete"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 /> Delete
                </Button>
              )}
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
