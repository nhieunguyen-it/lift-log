import { TRAINING } from '@/config/training';
import {
  defaultAnalyzerOptions,
  e1rmSeries,
  exerciseHistories,
  longTrend as engineLongTrend,
} from '../engine';
import type { E1rmPoint } from '../engine';
import { detectDeload } from '../recommend';
import type { DeloadSignal } from '../recommend';
import type { AnalysisInput, ExerciseDeloadHint, LongTrend } from '../types';

function dismissed(input: AnalysisInput, key: string): boolean {
  const at = input.deloadDismissals[key];
  return at !== undefined && input.now - at < TRAINING.deload.dismissMs;
}

/**
 * The deload suggestion to show, or null when none is warranted or it was dismissed
 * within `deload.dismissMs` of `input.now`.
 */
export function deloadSignal(input: AnalysisInput): DeloadSignal | null {
  const signal = detectDeload(input.data);
  if (!signal.overall) return null;
  return dismissed(input, signal.key) ? null : signal;
}

/**
 * The per-exercise hint for a workout target chip, or null when the exercise isn't flagged,
 * a full deload is suggested instead, or the hint was dismissed.
 */
export function exerciseDeloadHint(
  input: AnalysisInput,
  exerciseId: string,
): ExerciseDeloadHint | null {
  const signal = detectDeload(input.data);
  if (signal.overall) return null;
  const flagged = signal.exercises.find((e) => e.exerciseId === exerciseId);
  if (!flagged) return null;
  // Per exercise only: a new session must not revive a hint the user just dismissed.
  const key = `exercise:${exerciseId}`;
  if (dismissed(input, key)) return null;
  return { exerciseId, key, detail: flagged.detail };
}

/** Weekly weighted sets per muscle over the long trend window, with the user's targets. */
export function longTrend(input: AnalysisInput, refTs: number): LongTrend {
  const { weekStartsOn, targets } = input.settings;
  const trend = engineLongTrend(
    input.data,
    refTs,
    defaultAnalyzerOptions({ weekStartsOn, targets }),
  );
  return { trend, targets };
}

/** e1RM per session for one exercise, oldest first. */
export function e1rmHistory(input: AnalysisInput, exerciseId: string): E1rmPoint[] {
  return e1rmSeries(exerciseHistories(input.data).get(exerciseId) ?? []);
}
