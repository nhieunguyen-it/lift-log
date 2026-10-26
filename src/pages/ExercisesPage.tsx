import { useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import ExerciseDetailDialog from '@/components/ExerciseDetailDialog';
import { CustomBadge, CustomExerciseDialog, ExercisePlaceholder } from '@/components/custom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useExercisesWithMuscles, useMuscles } from '@/db';
import { filterExercises } from '@/lib/exerciseFilter';

type Scope = 'all' | 'custom';

export default function ExercisesPage() {
  const all = useExercisesWithMuscles();
  const muscles = useMuscles();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const results = useMemo(
    () => filterExercises(all ?? [], { query, customOnly: scope === 'custom' }),
    [all, query, scope],
  );
  const hasCustom = (all ?? []).some((e) => e.exercise.isCustom);
  const names = useMemo(() => new Map((muscles ?? []).map((m) => [m.id, m.name])), [muscles]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Exercises</h1>
        <Button
          size="sm"
          data-testid="new-exercise"
          onClick={() => setEditor({ open: true, id: null })}
        >
          <Plus /> New exercise
        </Button>
      </div>
      <Input
        data-testid="exercise-search"
        aria-label="Search exercises"
        placeholder="Search by name or alias"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div role="group" aria-label="Show" className="grid grid-cols-2 gap-2">
        {(['all', 'custom'] as Scope[]).map((s) => (
          <Button
            key={s}
            variant={scope === s ? 'default' : 'outline'}
            aria-pressed={scope === s}
            data-testid={`exercise-scope-${s}`}
            onClick={() => setScope(s)}
          >
            {s === 'all' ? 'All' : 'Custom'}
          </Button>
        ))}
      </div>
      <ul className="space-y-2">
        {results.map(({ exercise, muscles: links }) => (
          <li key={exercise.id} className="flex items-stretch gap-1">
            <button
              type="button"
              data-testid="exercise-item"
              aria-label={`${exercise.name} details`}
              className="hover:bg-accent/50 flex min-w-0 flex-1 items-center gap-3 rounded-lg border p-3 text-left"
              onClick={() => setOpenId(exercise.id)}
            >
              {exercise.images[0] ? (
                <img
                  src={exercise.images[0]}
                  alt=""
                  loading="lazy"
                  width={56}
                  height={56}
                  className="bg-muted size-14 shrink-0 rounded-md object-cover"
                />
              ) : (
                <ExercisePlaceholder size={56} />
              )}
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-medium">
                  <span className="break-words">{exercise.name}</span>
                  {exercise.isCustom && <CustomBadge />}
                </span>
                <span className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline">{exercise.equipment}</Badge>
                  {links.map((l) => (
                    <Badge key={l.muscleId} variant="secondary">
                      {names.get(l.muscleId) ?? l.muscleId} {Math.round(l.weight * 100)}%
                    </Badge>
                  ))}
                </span>
              </span>
            </button>
            {exercise.isCustom && (
              <Button
                variant="outline"
                size="icon"
                className="h-auto min-h-11"
                aria-label={`Edit ${exercise.name}`}
                data-testid="edit-custom-exercise"
                onClick={() => setEditor({ open: true, id: exercise.id })}
              >
                <Pencil />
              </Button>
            )}
          </li>
        ))}
        {all && scope === 'custom' && !hasCustom && (
          <li
            className="text-muted-foreground space-y-2 rounded-lg border border-dashed p-4 text-sm"
            data-testid="custom-empty"
          >
            <p>No custom exercises yet. Add a movement that is not in the built-in list.</p>
            <Button size="sm" variant="outline" onClick={() => setEditor({ open: true, id: null })}>
              <Plus /> Create your first exercise
            </Button>
          </li>
        )}
        {all && results.length === 0 && !(scope === 'custom' && !hasCustom) && (
          <li className="text-muted-foreground text-sm">No exercises found.</li>
        )}
      </ul>
      <ExerciseDetailDialog exerciseId={openId} onClose={() => setOpenId(null)} />
      <CustomExerciseDialog
        open={editor.open}
        exerciseId={editor.id}
        onClose={() => setEditor({ open: false, id: null })}
      />
    </section>
  );
}
