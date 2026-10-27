import type { MuscleId } from '@/data';
import { defaultAnalyzerOptions, e1rmSeries, exerciseHistories, longTrend } from '@/analyzer';
import type { E1rmPoint, MuscleTrendPoint } from '@/analyzer';
import type { VolumeTarget } from '@/config/training';
import { detectDeload } from '@/recommend';
import type { DeloadSignal } from '@/recommend';
import { loadTrainingData } from './analysisRepo';
import {
  getDeloadDismissals,
  getTargetOverrides,
  getWeekStartsOn,
  resolveTargets,
  setDeloadDismissals,
} from './settingsRepo';
import { TRAINING } from '@/config/training';

/**
 * The deload suggestion to show, or null when none is warranted or it was dismissed
 * within `deload.dismissMs`. Read-only: never changes workout data.
 */
export async function getDeloadSignal(now = Date.now()): Promise<DeloadSignal | null> {
  const [data, dismissals] = await Promise.all([loadTrainingData(), getDeloadDismissals()]);
  const signal = detectDeload(data);
  if (!signal.overall) return null;
  const at = dismissals[signal.key];
  if (at !== undefined && now - at < TRAINING.deload.dismissMs) return null;
  return signal;
}

/** Phase 4: one exercise flagged by deload detection while there is no overall signal. */
export interface ExerciseDeloadHint {
  exerciseId: string;
  /** Dismissal key in the shared deload-dismissal storage. */
  key: string;
  /** e.g. "e1RM down 6% over 4 sessions". */
  detail: string;
}

/**
 * The per-exercise hint to show on a workout target chip, or null when the exercise isn't
 * flagged, a full deload is suggested instead, or the hint was dismissed. Read-only.
 */
export async function getExerciseDeloadHint(
  exerciseId: string,
  now = Date.now(),
): Promise<ExerciseDeloadHint | null> {
  const [data, dismissals] = await Promise.all([loadTrainingData(), getDeloadDismissals()]);
  const signal = detectDeload(data);
  if (signal.overall) return null;
  const flagged = signal.exercises.find((e) => e.exerciseId === exerciseId);
  if (!flagged) return null;
  // Per exercise only: a new session must not revive a hint the user just dismissed.
  const key = `exercise:${exerciseId}`;
  const at = dismissals[key];
  if (at !== undefined && now - at < TRAINING.deload.dismissMs) return null;
  return { exerciseId, key, detail: flagged.detail };
}

/** Hide this suggestion for `deload.dismissMs`. Also prunes expired dismissals. */
export async function dismissDeload(key: string, now = Date.now()): Promise<void> {
  const current = await getDeloadDismissals();
  const kept: Record<string, number> = {};
  for (const [k, at] of Object.entries(current)) {
    if (now - at < TRAINING.deload.dismissMs) kept[k] = at;
  }
  kept[key] = now;
  await setDeloadDismissals(kept);
}

export interface LongTrend {
  /** Oldest first: `longTrendWeeks` previous weeks then the current week. */
  trend: Record<MuscleId, MuscleTrendPoint[]>;
  targets: Record<MuscleId, VolumeTarget>;
}

/** Weekly weighted sets per muscle over the long trend window, with the user's targets. */
export async function getLongTrend(refTs = Date.now()): Promise<LongTrend> {
  const [data, weekStartsOn, overrides] = await Promise.all([
    loadTrainingData(),
    getWeekStartsOn(),
    getTargetOverrides(),
  ]);
  const targets = resolveTargets(overrides);
  const trend = longTrend(data, refTs, defaultAnalyzerOptions({ weekStartsOn, targets }));
  return { trend, targets };
}

/** e1RM per session for one exercise, oldest first. */
export async function getE1rmHistory(exerciseId: string): Promise<E1rmPoint[]> {
  const data = await loadTrainingData();
  return e1rmSeries(exerciseHistories(data).get(exerciseId) ?? []);
}
