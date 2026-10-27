import { Suspense, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import HelpButton from '@/components/guide/HelpButton';
import { shiftWeek, weekWindow } from '@/analyzer';
import type { MuscleId } from '@/data';
import { TRAINING } from '@/config/training';
import { Card } from '@/components/ui/card';
import AnalyzeSkeleton from '@/components/analyze/AnalyzeSkeleton';
import CollapsibleSection from '@/components/analyze/CollapsibleSection';
import MuscleDetailSheet from '@/components/analyze/MuscleDetailSheet';
import MuscleList from '@/components/analyze/MuscleList';
import NeedsAttention from '@/components/analyze/NeedsAttention';
import PlanVsActualCard from '@/components/analyze/PlanVsActualCard';
import SummaryCard from '@/components/analyze/SummaryCard';
import VolumeSuggestionList from '@/components/recommend/VolumeSuggestionList';
import WeekSwitcher from '@/components/analyze/WeekSwitcher';
import DeloadCard from '@/components/progress/DeloadCard';
const BodyMap = lazy(() => import('@/components/analyze/BodyMap'));
import { setAnalyzeGrouping, useAnalyzeGrouping, useAnalyzeView } from '@/db/analyzeHooks';
import { useExercisesWithMuscles, useWeekStartsOn } from '@/db';

const VolumeTrendChart = lazy(() => import('@/components/progress/VolumeTrendChart'));

export default function AnalyzePage() {
  const [now] = useState(() => Date.now());
  const [refTs, setRefTs] = useState(now);
  const [selected, setSelected] = useState<MuscleId | null>(null);
  const wso = useWeekStartsOn() ?? 1;
  const analysis = useAnalyzeView(refTs);
  const grouping = useAnalyzeGrouping() ?? 'muscle';
  const exercises = useExercisesWithMuscles();

  const names = useMemo(
    () => new Map((exercises ?? []).map((e) => [e.exercise.id, e.exercise.name])),
    [exercises],
  );
  const exerciseName = (id: string) => names.get(id) ?? id;

  const win = weekWindow(refTs, wso);
  const isCurrent = win.end > now;
  const move = (d: number) => setRefTs(shiftWeek(win, d, wso).start);
  const motion = { ['--analyze-ms' as string]: `${TRAINING.analyzeUi.transitionMs}ms` };

  return (
    <section className="space-y-4" style={motion}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold">Analyze</h1>
          <HelpButton anchor="analyze-statuses" label="reading Analyze" />
        </div>
        <WeekSwitcher
          window={analysis?.result.current.window ?? win}
          isCurrent={isCurrent}
          onPrev={() => move(-1)}
          onNext={() => move(1)}
        />
      </div>
      <DeloadCard />

      {!analysis ? (
        <AnalyzeSkeleton />
      ) : analysis.empty ? (
        <Card className="space-y-2 p-5 text-center" data-testid="analyze-empty">
          <p className="font-medium">No workouts yet</p>
          <p className="text-muted-foreground text-sm">
            Log a workout and your weekly muscle volume will show up here. Or pick a program to
            follow and plan your week.
          </p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link
              to="/"
              className="text-primary inline-flex min-h-11 items-center font-medium underline"
            >
              Go to Workout
            </Link>
            <Link
              to="/programs"
              className="text-primary inline-flex min-h-11 items-center font-medium underline"
            >
              Browse Programs
            </Link>
          </div>
        </Card>
      ) : (
        <div key={analysis.result.current.window.start} className="analyze-enter space-y-4">
          {analysis.result.current.exercisesDone.length === 0 && (
            <p className="text-muted-foreground text-sm" role="status">
              No sets logged this week.
            </p>
          )}
          <SummaryCard summary={analysis.summary} />
          <NeedsAttention items={analysis.summary.needsAttention} onSelect={setSelected} />

          <PlanVsActualCard refTs={refTs} />

          <CollapsibleSection title="Body map" defaultOpen>
            <Suspense
              fallback={
                <div className="bg-muted h-72 animate-pulse rounded-xl motion-reduce:animate-none" />
              }
            >
              <BodyMap
                muscles={analysis.result.current.muscles}
                selected={selected}
                onSelect={setSelected}
                counts={analysis.summary.statusCounts}
              />
            </Suspense>
          </CollapsibleSection>

          <section
            aria-labelledby="suggestions-h"
            className="space-y-2"
            data-testid="suggestion-card"
          >
            <h2 id="suggestions-h" className="text-base font-medium">
              This week&apos;s suggestions
            </h2>
            <VolumeSuggestionList
              suggestions={analysis.suggestions}
              onSelect={setSelected}
              limit={2}
            />
          </section>

          <CollapsibleSection title="12-week trend">
            <Suspense
              fallback={
                <div
                  className="bg-muted h-48 animate-pulse rounded-md motion-reduce:animate-none"
                  aria-hidden="true"
                />
              }
            >
              <VolumeTrendChart
                defaultMuscleId={analysis.summary.needsAttention[0]?.muscleId ?? 'chest'}
              />
            </Suspense>
          </CollapsibleSection>

          <MuscleList
            muscles={analysis.result.current.muscles}
            trend={analysis.result.trend}
            grouping={grouping}
            onGroupingChange={(g) => void setAnalyzeGrouping(g)}
            onSelect={setSelected}
          />

          <MuscleDetailSheet
            muscle={selected ? analysis.result.current.muscles[selected] : null}
            trend={selected ? analysis.result.trend[selected] : undefined}
            suggestion={
              selected ? analysis.suggestions.find((s) => s.muscleId === selected) : undefined
            }
            exerciseName={exerciseName}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
    </section>
  );
}
