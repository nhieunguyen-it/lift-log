import { deloadSignal, e1rmHistory, exerciseDeloadHint, longTrendView } from '@/analysis';
import type { DeloadSignal, E1rmPoint, ExerciseDeloadHint, LongTrend } from '@/analysis';
import { loadAnalysisInput } from './localAnalysisClient';
import { getDeloadDismissals, setDeloadDismissals } from './settingsRepo';
import { TRAINING } from '@/config/training';

export type { ExerciseDeloadHint, LongTrend } from '@/analysis';

/**
 * The deload suggestion to show, or null when none is warranted or it was dismissed
 * within `deload.dismissMs`. Read-only: never changes workout data.
 */
export async function getDeloadSignal(now = Date.now()): Promise<DeloadSignal | null> {
  return deloadSignal(await loadAnalysisInput(now));
}

/**
 * The per-exercise hint to show on a workout target chip, or null when the exercise isn't
 * flagged, a full deload is suggested instead, or the hint was dismissed. Read-only.
 */
export async function getExerciseDeloadHint(
  exerciseId: string,
  now = Date.now(),
): Promise<ExerciseDeloadHint | null> {
  return exerciseDeloadHint(await loadAnalysisInput(now), exerciseId);
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

/** Weekly weighted sets per muscle over the long trend window, with the user's targets. */
export async function getLongTrend(refTs = Date.now()): Promise<LongTrend> {
  return longTrendView(await loadAnalysisInput(), refTs);
}

/** e1RM per session for one exercise, oldest first. */
export async function getE1rmHistory(exerciseId: string): Promise<E1rmPoint[]> {
  return e1rmHistory(await loadAnalysisInput(), exerciseId);
}
