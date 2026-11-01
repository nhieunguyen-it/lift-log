import { analyze, defaultAnalyzerOptions, shiftWeek, summarizeWeek } from '../engine';
import type { WeekWindow } from '../engine';
import { volumeSuggestions } from '../recommend';
import type { AnalysisInput, AnalysisView, AnalyzeView, Session } from '../types';

/** Finished sessions that started inside the week window. */
export function countFinishedSessions(sessions: Session[], win: WeekWindow): number {
  return sessions.filter(
    (s) => s.finishedAt !== undefined && s.startedAt >= win.start && s.startedAt < win.end,
  ).length;
}

function options(input: AnalysisInput) {
  return defaultAnalyzerOptions({
    weekStartsOn: input.settings.weekStartsOn,
    targets: input.settings.targets,
  });
}

/** Analysis of the week containing `refTs`, plus volume suggestions for it. */
export function analysis(input: AnalysisInput, refTs: number): AnalysisView {
  const { data, settings } = input;
  const result = analyze(data, refTs, options(input));
  const suggestions = volumeSuggestions({
    week: result.current,
    exercises: data.exercises,
    exerciseMuscles: data.exerciseMuscles,
    availableEquipment: settings.equipment,
  });
  return { result, suggestions, empty: data.sessions.length === 0 };
}

/** Analysis + volume suggestions + the at-a-glance summary for the week containing `refTs`. */
export function analyzeView(input: AnalysisInput, refTs: number): AnalyzeView {
  const { data, settings, program } = input;
  const base = analysis(input, refTs);
  const prevStart = shiftWeek(base.result.current.window, -1, settings.weekStartsOn).start;
  const previous = analyze(data, prevStart, { ...options(input), trendWeeks: 0 }).current;
  const summary = summarizeWeek(
    base.result.current,
    previous,
    program.active
      ? {
          sessionsDone: countFinishedSessions(data.sessions, base.result.current.window),
          plannedSessions: program.active.days.length,
        }
      : undefined,
  );
  return { ...base, summary };
}
