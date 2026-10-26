import { MUSCLE_IDS } from '@/data';
import type { MuscleId } from '@/data';
import type { SetRow } from '@/db/types';
import type { VolumeTarget } from '@/config/training';
import { TRAINING } from '@/config/training';
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

/** Single pass: counted sets per exercise, bucketed into the given windows (by session start). */
function bucketSets(
  data: TrainingData,
  windows: WeekWindow[],
  maxCountedRir: number,
): Map<string, number>[] {
  const buckets = windows.map(() => new Map<string, number>());
  const sessionStart = new Map<string, number>();
  for (const s of data.sessions) sessionStart.set(s.id, s.startedAt);
  const seInfo = new Map<string, { sessionId: string; exerciseId: string }>();
  for (const se of data.sessionExercises) {
    seInfo.set(se.id, { sessionId: se.sessionId, exerciseId: se.exerciseId });
  }
  const lo = windows[0].start;
  const hi = windows[windows.length - 1].end;
  for (const set of data.sets) {
    if (!isCountedSet(set, maxCountedRir)) continue;
    const se = seInfo.get(set.sessionExerciseId);
    if (!se) continue;
    const startedAt = sessionStart.get(se.sessionId);
    if (startedAt === undefined || startedAt < lo || startedAt >= hi) continue;
    for (let i = 0; i < windows.length; i++) {
      if (startedAt >= windows[i].start && startedAt < windows[i].end) {
        const m = buckets[i];
        m.set(se.exerciseId, (m.get(se.exerciseId) ?? 0) + 1);
        break;
      }
    }
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
  exerciseSets: Map<string, number>,
  weights: Map<string, { muscleId: MuscleId; weight: number }[]>,
  opts: AnalyzerOptions,
): WeekAnalysis {
  const contribs = {} as Record<MuscleId, MuscleContribution[]>;
  const totals = {} as Record<MuscleId, number>;
  for (const id of MUSCLE_IDS) {
    contribs[id] = [];
    totals[id] = 0;
  }
  for (const [exerciseId, sets] of exerciseSets) {
    for (const { muscleId, weight } of weights.get(exerciseId) ?? []) {
      const weightedSets = sets * weight;
      contribs[muscleId].push({ exerciseId, sets, weightedSets });
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
