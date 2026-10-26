/** Fatigue / deload detection. Pure and config-driven: never mutates its input. */
import { TRAINING } from '@/config/training';
import type { TrainingConfig } from '@/config/training';
import { exerciseHistories, sessionE1RmKg } from '@/analyzer/exerciseStats';
import type { ExerciseSessionSets, LoggedSet, TrainingData } from '@/analyzer/types';
import { countMisses, repRangeFor } from './progression';
import type { DeloadReason, DeloadSignal, ExerciseFatigue } from './types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function avg(xs: number[]): number | undefined {
  return xs.length === 0 ? undefined : xs.reduce((a, b) => a + b, 0) / xs.length;
}

const avgReps = (sets: LoggedSet[]) => avg(sets.map((s) => s.reps));
const avgRir = (sets: LoggedSet[]) =>
  avg(sets.flatMap((s) => (s.rir === undefined ? [] : [s.rir])));

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Check one exercise. `window` is newest first and already limited to the lookback.
 * Returns the reasons that fired plus a human detail line.
 */
export function exerciseFatigue(
  exerciseId: string,
  window: ExerciseSessionSets[],
  repRange: { min: number; max: number },
  config: TrainingConfig = TRAINING,
): ExerciseFatigue | null {
  const c = config.deload;
  if (window.length < c.minSessions) return null;
  const reasons: DeloadReason[] = [];
  const details: string[] = [];

  // (a) e1RM drop from the window's peak to the latest session.
  const e1 = window.map(sessionE1RmKg);
  const latestE1 = e1[0];
  const known = e1.filter((x): x is number => x !== undefined);
  if (latestE1 !== undefined && known.length >= c.minSessions) {
    const peak = Math.max(...known);
    const drop = (peak - latestE1) / peak;
    if (drop >= c.e1rmDropFraction) {
      reasons.push('e1rm_drop');
      details.push(`e1RM down ${pct(drop)} over ${window.length} sessions`);
    }
  }

  // (b) average RIR falling (closer to failure) while average reps fall.
  const newest = window[0];
  const oldest = window[window.length - 1];
  const rirNew = avgRir(newest.sets);
  const rirOld = avgRir(oldest.sets);
  const repsNew = avgReps(newest.sets);
  const repsOld = avgReps(oldest.sets);
  if (
    rirNew !== undefined &&
    rirOld !== undefined &&
    repsNew !== undefined &&
    repsOld !== undefined &&
    rirOld - rirNew >= c.rirDrop &&
    repsNew < repsOld
  ) {
    reasons.push('rir_and_reps_down');
    details.push(
      `RIR down ${Math.round((rirOld - rirNew) * 10) / 10} while reps fell ${Math.round(repsOld * 10) / 10} to ${Math.round(repsNew * 10) / 10}`,
    );
  }

  // (c) repeated misses: the same counter progression uses for its deload action.
  const misses = countMisses(window, repRange);
  if (misses >= config.missesToDeload) {
    reasons.push('repeated_misses');
    details.push(`missed ${repRange.min} reps ${misses} sessions in a row`);
  }

  if (reasons.length === 0) return null;
  return { exerciseId, reasons, detail: details.join('; ') };
}

/**
 * Deload signal for the whole log. An exercise is only considered when its latest session is
 * within `lookbackSessions` weeks of the newest logged session (so long-dropped lifts don't nag).
 * `overall` is true when at least `exercisesForOverall` exercises are flagged.
 */
export function detectDeload(data: TrainingData, config: TrainingConfig = TRAINING): DeloadSignal {
  const c = config.deload;
  const histories = exerciseHistories(data);
  let newestTs = 0;
  for (const h of histories.values()) newestTs = Math.max(newestTs, h[0].startedAt);
  const exById = new Map(data.exercises.map((e) => [e.id, e]));

  const flagged: ExerciseFatigue[] = [];
  let latestSession: { id: string; ts: number } | undefined;
  for (const [exerciseId, history] of histories) {
    const ex = exById.get(exerciseId);
    if (!ex) continue;
    if (newestTs - history[0].startedAt > c.lookbackSessions * WEEK_MS) continue;
    const f = exerciseFatigue(
      exerciseId,
      history.slice(0, c.lookbackSessions),
      repRangeFor(ex, config),
      config,
    );
    if (!f) continue;
    flagged.push(f);
    if (!latestSession || history[0].startedAt > latestSession.ts) {
      latestSession = { id: history[0].sessionId, ts: history[0].startedAt };
    }
  }
  flagged.sort((a, b) => a.exerciseId.localeCompare(b.exerciseId));
  return {
    overall: flagged.length >= c.exercisesForOverall,
    exercises: flagged,
    setsFraction: c.setsFraction,
    targetRir: c.targetRir,
    key: `${flagged.map((f) => f.exerciseId).join(',')}@${latestSession?.id ?? ''}`,
  };
}
