import { analyze, defaultAnalyzerOptions, shiftWeek, summarizeWeek } from '@/analyzer';
import type { WeekSummary, WeekWindow } from '@/analyzer';
import { volumeSuggestions } from '@/recommend';
import { loadTrainingData } from './analysisRepo';
import type { AnalysisView } from './analysisRepo';
import { getActiveProgram } from './programsRepo';
import { getEquipment, getTargetOverrides, getWeekStartsOn, resolveTargets } from './settingsRepo';
import type { Session } from './types';

export interface AnalyzeView extends AnalysisView {
  summary: WeekSummary;
}

/** Finished sessions that started inside the week window. */
export function countFinishedSessions(sessions: Session[], win: WeekWindow): number {
  return sessions.filter(
    (s) => s.finishedAt !== undefined && s.startedAt >= win.start && s.startedAt < win.end,
  ).length;
}

/** Analysis + volume suggestions + the at-a-glance summary for the week containing `refTs`. */
export async function getAnalyzeView(refTs: number): Promise<AnalyzeView> {
  const [data, weekStartsOn, overrides, equipment, program] = await Promise.all([
    loadTrainingData(),
    getWeekStartsOn(),
    getTargetOverrides(),
    getEquipment(),
    getActiveProgram(),
  ]);
  const opts = defaultAnalyzerOptions({ weekStartsOn, targets: resolveTargets(overrides) });
  const result = analyze(data, refTs, opts);
  const prevStart = shiftWeek(result.current.window, -1, weekStartsOn).start;
  const previous = analyze(data, prevStart, { ...opts, trendWeeks: 0 }).current;
  const suggestions = volumeSuggestions({
    week: result.current,
    exercises: data.exercises,
    exerciseMuscles: data.exerciseMuscles,
    availableEquipment: equipment,
  });
  const summary = summarizeWeek(
    result.current,
    previous,
    program
      ? {
          sessionsDone: countFinishedSessions(data.sessions, result.current.window),
          plannedSessions: program.days.length,
        }
      : undefined,
  );
  return { result, suggestions, empty: data.sessions.length === 0, summary };
}
