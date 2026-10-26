import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { shiftWeek, weekWindow } from '@/analyzer';
import type { MuscleId } from '@/data';
import { Card } from '@/components/ui/card';
import BodyMap from '@/components/analyze/BodyMap';
import MuscleDetailSheet, { suggestionText } from '@/components/analyze/MuscleDetailSheet';
import MuscleList from '@/components/analyze/MuscleList';
import { muscleName } from '@/components/analyze/muscleSort';
import StatusLegend from '@/components/analyze/StatusLegend';
import WeekSwitcher from '@/components/analyze/WeekSwitcher';
import { useAnalysis, useExercisesWithMuscles, useWeekStartsOn } from '@/db';

export default function AnalyzePage() {
  const [now] = useState(() => Date.now());
  const [refTs, setRefTs] = useState(now);
  const [selected, setSelected] = useState<MuscleId | null>(null);
  const wso = useWeekStartsOn() ?? 1;
  const analysis = useAnalysis(refTs);
  const exercises = useExercisesWithMuscles();

  const names = useMemo(
    () => new Map((exercises ?? []).map((e) => [e.exercise.id, e.exercise.name])),
    [exercises],
  );
  const exerciseName = (id: string) => names.get(id) ?? id;

  const win = weekWindow(refTs, wso);
  const isCurrent = win.end > now;
  const move = (d: number) => setRefTs(shiftWeek(win, d, wso).start);

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Analyze</h1>
      <WeekSwitcher
        window={analysis?.result.current.window ?? win}
        isCurrent={isCurrent}
        onPrev={() => move(-1)}
        onNext={() => move(1)}
      />

      {!analysis ? (
        <p className="text-muted-foreground" role="status">
          Loading…
        </p>
      ) : analysis.empty ? (
        <Card className="space-y-2 p-5 text-center" data-testid="analyze-empty">
          <p className="font-medium">No workouts yet</p>
          <p className="text-muted-foreground text-sm">
            Log a workout and your weekly muscle volume will show up here.
          </p>
          <Link to="/" className="text-primary font-medium underline">
            Go to Workout
          </Link>
        </Card>
      ) : (
        <>
          {analysis.result.current.exercisesDone.length === 0 && (
            <p className="text-muted-foreground text-sm" role="status">
              No sets logged this week.
            </p>
          )}
          <BodyMap muscles={analysis.result.current.muscles} onSelect={setSelected} />
          <StatusLegend />

          <Card className="space-y-2 p-4" data-testid="suggestion-card">
            <h2 className="text-lg font-medium">This week&apos;s suggestions</h2>
            {analysis.suggestions.length === 0 ? (
              <p className="text-sm">Nothing to fix. Your volume looks balanced for this week.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {analysis.suggestions.map((s) => (
                  <li key={`${s.kind}-${s.muscleId}`}>
                    <button
                      type="button"
                      className="min-h-11 text-left"
                      onClick={() => setSelected(s.muscleId)}
                    >
                      <span className="font-medium">{muscleName(s.muscleId)}:</span>{' '}
                      {suggestionText(s, exerciseName)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <MuscleList muscles={analysis.result.current.muscles} onSelect={setSelected} />

          <MuscleDetailSheet
            muscle={selected ? analysis.result.current.muscles[selected] : null}
            trend={selected ? analysis.result.trend[selected] : undefined}
            suggestion={
              selected ? analysis.suggestions.find((s) => s.muscleId === selected) : undefined
            }
            exerciseName={exerciseName}
            onClose={() => setSelected(null)}
          />
        </>
      )}
    </section>
  );
}
