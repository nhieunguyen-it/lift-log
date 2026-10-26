import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useExercisesWithMuscles, useMuscles } from '@/db';
import { filterExercises } from '@/lib/exerciseFilter';

export default function ExercisesPage() {
  const all = useExercisesWithMuscles();
  const muscles = useMuscles();
  const [query, setQuery] = useState('');
  const results = useMemo(() => filterExercises(all ?? [], { query }), [all, query]);
  const names = useMemo(() => new Map((muscles ?? []).map((m) => [m.id, m.name])), [muscles]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Exercises</h1>
      <Input
        data-testid="exercise-search"
        aria-label="Search exercises"
        placeholder="Search by name or alias"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="space-y-2">
        {results.map(({ exercise, muscles: links }) => (
          <li key={exercise.id} data-testid="exercise-item" className="rounded-lg border p-3">
            <p className="font-medium">{exercise.name}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="outline">{exercise.equipment}</Badge>
              {links.map((l) => (
                <Badge key={l.muscleId} variant="secondary">
                  {names.get(l.muscleId) ?? l.muscleId} {Math.round(l.weight * 100)}%
                </Badge>
              ))}
            </div>
          </li>
        ))}
        {all && results.length === 0 && (
          <li className="text-muted-foreground text-sm">No exercises found.</li>
        )}
      </ul>
    </section>
  );
}
