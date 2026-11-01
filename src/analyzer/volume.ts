import { MUSCLE_IDS } from '@/data';
import type { MuscleId } from '@/data';
import type { CardioEntry, SetRow } from '@/analysis/rows';
import type { VolumeTarget } from '@/config/training';
import { TRAINING } from '@/config/training';
import { cardioSetCredit, countedMinutes, isCardio, isCountedEntry } from './cardio';
import { shiftWeek, weekWindow } from './week';
import type {
  AnalyzerOptions,
  AnalyzerResult,
  MuscleContribution,
  MuscleStatus,
  MuscleTrendPoint,
  MuscleWeek,
  TrainingData,
  WeekAnalysis,
  WeekWindow,
} from './types';

export function defaultAnalyzerOptions(overrides: Partial<AnalyzerOptions> = {}): AnalyzerOptions {
  return {
    weekStartsOn: 1,
    targets: TRAINING.targets,
    maxCountedRir: TRAINING.maxCountedRir,
    trendWeeks: TRAINING.trendWeeks,
    ...overrides,
  };
}

export function statusFor(sets: number, t: VolumeTarget): MuscleStatus {
  if (sets === 0) return 'none';
  if (sets < t.mev) return 'below';
  if (sets < t.mavLow) return 'building';
  if (sets <= t.mavHigh) return 'optimal';
  if (sets <= t.mrv) return 'high';
  return 'over';
}

export function isCountedSet(set: SetRow, maxCountedRir: number): boolean {
  return (
    set.completedAt !== undefined &&
    !set.isWarmup &&
    set.reps > 0 &&
    (set.rir === undefined || set.rir <= maxCountedRir)
  );
}

interface Bucket {
  sets: number;
  minutes: number;
}

/**
 * Single pass: counted sets (and cardio set-equivalents + minutes) per exercise, bucketed into
 * the given windows (by session start).
 */
function bucketSets(
  data: TrainingData,
  windows: WeekWindow[],
  maxCountedRir: number,
): Map<string, Bucket>[] {
  const buckets = windows.map(() => new Map<string, Bucket>());
  const sessionStart = new Map<string, number>();
  for (const s of data.sessions) sessionStart.set(s.id, s.startedAt);
  const seInfo = new Map<string, { sessionId: string; exerciseId: string }>();
  for (const se of data.sessionExercises) {
    seInfo.set(se.id, { sessionId: se.sessionId, exerciseId: se.exerciseId });
  }
  const lo = windows[0].start;
  const hi = windows[windows.length - 1].end;
  const bucketFor = (
    sessionExerciseId: string,
  ): { m: Map<string, Bucket>; exerciseId: string } | null => {
    const se = seInfo.get(sessionExerciseId);
    if (!se) return null;
    const startedAt = sessionStart.get(se.sessionId);
    if (startedAt === undefined || startedAt < lo || startedAt >= hi) return null;
    for (let i = 0; i < windows.length; i++) {
      if (startedAt >= windows[i].start && startedAt < windows[i].end) {
        return { m: buckets[i], exerciseId: se.exerciseId };
      }
    }
    return null;
  };
  const add = (m: Map<string, Bucket>, exerciseId: string, sets: number, minutes: number) => {
    const b = m.get(exerciseId);
    if (b) {
      b.sets += sets;
      b.minutes += minutes;
    } else m.set(exerciseId, { sets, minutes });
  };
  for (const set of data.sets) {
    if (!isCountedSet(set, maxCountedRir)) continue;
    const hit = bucketFor(set.sessionExerciseId);
    if (hit) add(hit.m, hit.exerciseId, 1, 0);
  }

  // Cardio: credit is computed once per session exercise (it is capped per session).
  const cardioById = new Map<string, boolean>();
  for (const e of data.exercises) {
    if (isCardio(e) && e.cardioProfile !== undefined) cardioById.set(e.id, true);
  }
  const bySe = new Map<string, CardioEntry[]>();
  for (const entry of data.cardioEntries) {
    if (!isCountedEntry(entry)) continue;
    const list = bySe.get(entry.sessionExerciseId);
    if (list) list.push(entry);
    else bySe.set(entry.sessionExerciseId, [entry]);
  }
  for (const [seId, entries] of bySe) {
    const hit = bucketFor(seId);
    if (!hit || !cardioById.has(hit.exerciseId)) continue;
    add(hit.m, hit.exerciseId, cardioSetCredit(entries), countedMinutes(entries));
  }
  return buckets;
}

function muscleWeightsByExercise(
  data: TrainingData,
): Map<string, { muscleId: MuscleId; weight: number }[]> {
  const map = new Map<string, { muscleId: MuscleId; weight: number }[]>();
  for (const em of data.exerciseMuscles) {
    const list = map.get(em.exerciseId);
    const entry = { muscleId: em.muscleId as MuscleId, weight: em.weight };
    if (list) list.push(entry);
    else map.set(em.exerciseId, [entry]);
  }
  return map;
}

function buildWeek(
  window: WeekWindow,
  exerciseSets: Map<string, Bucket>,
  weights: Map<string, { muscleId: MuscleId; weight: number }[]>,
  opts: AnalyzerOptions,
): WeekAnalysis {
  const contribs = {} as Record<MuscleId, MuscleContribution[]>;
  const totals = {} as Record<MuscleId, number>;
  for (const id of MUSCLE_IDS) {
    contribs[id] = [];
    totals[id] = 0;
  }
  for (const [exerciseId, { sets, minutes }] of exerciseSets) {
    for (const { muscleId, weight } of weights.get(exerciseId) ?? []) {
      const weightedSets = sets * weight;
      const contribution: MuscleContribution = { exerciseId, sets, weightedSets };
      if (minutes > 0) contribution.minutes = minutes;
      contribs[muscleId].push(contribution);
      totals[muscleId] += weightedSets;
    }
  }
  const muscles = {} as Record<MuscleId, MuscleWeek>;
  for (const id of MUSCLE_IDS) {
    const target = opts.targets[id];
    muscles[id] = {
      muscleId: id,
      sets: totals[id],
      status: statusFor(totals[id], target),
      target,
      contributions: contribs[id].sort((a, b) => b.weightedSets - a.weightedSets),
    };
  }
  return { window, muscles, exercisesDone: [...exerciseSets.keys()] };
}

export function analyzeWeek(
  data: TrainingData,
  window: WeekWindow,
  opts: AnalyzerOptions,
): WeekAnalysis {
  const [bucket] = bucketSets(data, [window], opts.maxCountedRir);
  return buildWeek(window, bucket, muscleWeightsByExercise(data), opts);
}

export function analyze(data: TrainingData, refTs: number, opts: AnalyzerOptions): AnalyzerResult {
  const currentWindow = weekWindow(refTs, opts.weekStartsOn);
  const windows: WeekWindow[] = [];
  for (let i = opts.trendWeeks; i >= 1; i--) {
    windows.push(shiftWeek(currentWindow, -i, opts.weekStartsOn));
  }
  windows.push(currentWindow);
  const buckets = bucketSets(data, windows, opts.maxCountedRir);
  const weights = muscleWeightsByExercise(data);
  const analyses = windows.map((w, i) => buildWeek(w, buckets[i], weights, opts));
  const trend = {} as Record<MuscleId, MuscleTrendPoint[]>;
  for (const id of MUSCLE_IDS) {
    trend[id] = analyses.map((a) => ({ window: a.window, sets: a.muscles[id].sets }));
  }
  return { current: analyses[analyses.length - 1], trend };
}

/**
 * Weekly weighted sets per muscle over `longTrendWeeks` previous weeks plus the current one
 * (oldest first). Same counting rules as `analyze`.
 */
export function longTrend(
  data: TrainingData,
  refTs: number,
  opts: AnalyzerOptions,
  weeks: number = TRAINING.longTrendWeeks,
): Record<MuscleId, MuscleTrendPoint[]> {
  return analyze(data, refTs, { ...opts, trendWeeks: weeks }).trend;
}
