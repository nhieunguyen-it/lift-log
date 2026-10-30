import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CustomBadge, ExercisePlaceholder } from '@/components/custom';
import { useExercisesWithMuscles, useMuscles, useRecentExerciseIds } from '@/db';
import { filterExercises } from '@/lib/exerciseFilter';
import type { Equipment } from '@/data';

const EQUIPMENT: Equipment[] = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
];

const selectClass =
  'border-input bg-background h-11 w-full rounded-md border px-3 text-base md:text-sm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (exerciseId: string) => void;
}

export default function ExercisePicker({ open, onOpenChange, onPick }: Props) {
  const all = useExercisesWithMuscles();
  const muscles = useMuscles();
  const recent = useRecentExerciseIds();
  const [query, setQuery] = useState('');
  const [muscleId, setMuscleId] = useState('');
  const [equipment, setEquipment] = useState('');

  const results = useMemo(
    () =>
      filterExercises(all ?? [], {
        query,
        muscleId: muscleId || undefined,
        equipment: (equipment || undefined) as Equipment | undefined,
        recentIds: recent ?? [],
      }),
    [all, query, muscleId, equipment, recent],
  );
  const recentSet = useMemo(() => new Set(recent ?? []), [recent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-0 left-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 grid-rows-[auto_auto_minmax(0,1fr)] content-start rounded-none border-0 sm:max-w-none"
        data-testid="exercise-picker"
        onOpenAutoFocus={(e) => {
          // Keep the keyboard closed so the list stays visible on mobile.
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Add exercise</DialogTitle>
          <DialogDescription className="sr-only">
            Search and pick an exercise to add to your workout.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-3.5 left-3 size-4" aria-hidden />
            <Input
              data-testid="picker-search"
              aria-label="Search exercises"
              placeholder="Search by name or alias"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Filter by muscle"
              data-testid="picker-muscle"
              className={selectClass}
              value={muscleId}
              onChange={(e) => setMuscleId(e.target.value)}
            >
              <option value="">All muscles</option>
              {(muscles ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by equipment"
              data-testid="picker-equipment"
              className={selectClass}
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
            >
              <option value="">All equipment</option>
              {EQUIPMENT.map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ul className="-mx-1 min-h-0 overflow-y-auto px-1" data-testid="picker-list">
          {results.map(({ exercise, muscles: links }) => (
            <li key={exercise.id}>
              <button
                type="button"
                data-testid="picker-item"
                data-exercise-id={exercise.id}
                className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left"
                onClick={() => {
                  onPick(exercise.id);
                  onOpenChange(false);
                }}
              >
                {exercise.images[0] ? (
                  <img
                    src={exercise.images[0]}
                    alt=""
                    loading="lazy"
                    width={80}
                    height={80}
                    className="bg-muted size-20 shrink-0 rounded object-cover"
                  />
                ) : (
                  <ExercisePlaceholder size={80} className="rounded" />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {exercise.name}
                    {exercise.isCustom && <CustomBadge />}
                    {recentSet.has(exercise.id) && <Badge variant="secondary">Recent</Badge>}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {exercise.equipment} ·{' '}
                    {links
                      .filter((l) => l.weight >= 0.5)
                      .map((l) => muscles?.find((m) => m.id === l.muscleId)?.name ?? l.muscleId)
                      .join(', ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="text-muted-foreground p-4 text-center text-sm">No exercises found.</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
