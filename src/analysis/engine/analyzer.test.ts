import { describe, expect, it } from 'vitest';
import {
  analyze,
  analyzeWeek,
  defaultAnalyzerOptions,
  epley1Rm,
  exerciseStats,
  isCountedSet,
  shiftWeek,
  statusFor,
  weekWindow,
} from './index';
import type { VolumeTarget } from '@/config/training';
import { generateTrainingData, makeData, makeSession } from './fixtures';
import type { CardioEntry } from '../rows';
import type { TrainingData } from './types';

const T: VolumeTarget = { mev: 8, mavLow: 12, mavHigh: 18, mrv: 22 };
// Local-time helper: month is 0-based.
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m, d, h, min).getTime();
const opts = defaultAnalyzerOptions();
// 2026-03-04 is a Wednesday; Monday of that week is 2026-03-02.
const MON = at(2026, 2, 2);

describe('statusFor', () => {
  it('covers boundaries', () => {
    expect(statusFor(0, T)).toBe('none');
    expect(statusFor(0.5, T)).toBe('below');
    expect(statusFor(7.75, T)).toBe('below');
    expect(statusFor(8, T)).toBe('building');
    expect(statusFor(11.5, T)).toBe('building');
    expect(statusFor(12, T)).toBe('optimal');
    expect(statusFor(18, T)).toBe('optimal');
    expect(statusFor(18.5, T)).toBe('high');
    expect(statusFor(22, T)).toBe('high');
    expect(statusFor(22.5, T)).toBe('over');
  });
});

describe('weekWindow', () => {
  it('Monday start', () => {
    const w = weekWindow(at(2026, 2, 4, 15), 1);
    expect(w.start).toBe(MON);
    expect(w.end).toBe(at(2026, 2, 9));
  });
  it('Sunday start', () => {
    const w = weekWindow(at(2026, 2, 4, 15), 0);
    expect(w.start).toBe(at(2026, 2, 1));
    expect(w.end).toBe(at(2026, 2, 8));
    expect(weekWindow(at(2026, 2, 1, 0), 0).start).toBe(at(2026, 2, 1));
  });
  it('shiftWeek moves by calendar weeks', () => {
    const w = weekWindow(MON, 1);
    expect(shiftWeek(w, -1, 1).start).toBe(at(2026, 1, 23));
    expect(shiftWeek(w, 2, 1).start).toBe(at(2026, 2, 16));
  });
  it('assigns sets to the session start week even past midnight', () => {
    const sunday = at(2026, 2, 8, 23, 30);
    const data = makeData(
      makeSession('s', sunday, [
        { exerciseId: 'barbell-bench-press', sets: [{ completedAt: at(2026, 2, 9, 0, 30) }] },
      ]),
    );
    const earlier = analyzeWeek(data, weekWindow(MON, 1), opts);
    const later = analyzeWeek(data, weekWindow(at(2026, 2, 9), 1), opts);
    expect(earlier.muscles.chest.sets).toBe(1);
    expect(later.muscles.chest.sets).toBe(0);
  });
});

describe('isCountedSet', () => {
  const base = {
    id: 'x',
    sessionExerciseId: 'y',
    order: 0,
    reps: 5,
    isWarmup: false,
    completedAt: 1,
  };
  it('applies the rules', () => {
    expect(isCountedSet(base, 4)).toBe(true);
    expect(isCountedSet({ ...base, rir: 4 }, 4)).toBe(true);
    expect(isCountedSet({ ...base, rir: 5 }, 4)).toBe(false);
    expect(isCountedSet({ ...base, isWarmup: true }, 4)).toBe(false);
    expect(isCountedSet({ ...base, completedAt: undefined }, 4)).toBe(false);
  });
});

describe('analyzeWeek scenarios', () => {
  const w = weekWindow(MON, 1);
  it('bench press 4 sets', () => {
    const data = makeData(
      makeSession('a', MON + 3_600_000, [
        { exerciseId: 'barbell-bench-press', sets: [{}, {}, {}, {}] },
      ]),
    );
    const r = analyzeWeek(data, w, opts);
    expect(r.muscles.chest.sets).toBe(4);
    expect(r.muscles.front_delts.sets).toBe(2);
    expect(r.muscles.triceps.sets).toBe(2);
    expect(r.muscles.chest.status).toBe('below');
    expect(r.muscles.chest.contributions).toEqual([
      { exerciseId: 'barbell-bench-press', sets: 4, weightedSets: 4 },
    ]);
    expect(r.exercisesDone).toEqual(['barbell-bench-press']);
  });
  it('pull-up 3 sets', () => {
    const data = makeData(
      makeSession('a', MON + 1000, [{ exerciseId: 'pull-up', sets: [{}, {}, {}] }]),
    );
    const m = analyzeWeek(data, w, opts).muscles;
    expect(m.lats.sets).toBe(3);
    expect(m.upper_back.sets).toBe(1.5);
    expect(m.biceps.sets).toBe(1.5);
    expect(m.rear_delts.sets).toBe(0.75);
    expect(m.forearms.sets).toBe(0.75);
  });
  it('excludes warm-up, uncompleted, rir 5; counts rir 4 and undefined', () => {
    const data = makeData(
      makeSession('a', MON + 1000, [
        {
          exerciseId: 'barbell-bench-press',
          sets: [
            { isWarmup: true },
            { completedAt: null },
            { rir: 5 },
            { rir: 4 },
            { rir: undefined },
          ],
        },
      ]),
    );
    expect(analyzeWeek(data, w, opts).muscles.chest.sets).toBe(2);
  });
  it('sorts contributions descending', () => {
    const data = makeData(
      makeSession('a', MON + 1000, [
        { exerciseId: 'barbell-bench-press', sets: [{}] },
        { exerciseId: 'pull-up', sets: [{}, {}] },
      ]),
    );
    const c = analyzeWeek(data, w, opts).muscles.triceps.contributions;
    expect(c.map((x) => x.weightedSets)).toEqual(
      [...c.map((x) => x.weightedSets)].sort((a, b) => b - a),
    );
  });
});

describe('analyze trend', () => {
  it('has trendWeeks+1 points with values in the right weeks', () => {
    const week = (n: number) => at(2026, 2, 2 + 7 * n, 10);
    const data = makeData(
      makeSession('a', week(-4), [{ exerciseId: 'barbell-bench-press', sets: [{}] }]),
      makeSession('b', week(-1), [{ exerciseId: 'barbell-bench-press', sets: [{}, {}] }]),
      makeSession('c', week(0), [{ exerciseId: 'barbell-bench-press', sets: [{}, {}, {}] }]),
      makeSession('d', week(-5), [{ exerciseId: 'barbell-bench-press', sets: [{}, {}, {}, {}] }]),
    );
    const r = analyze(data, at(2026, 2, 5), opts);
    const t = r.trend.chest;
    expect(t).toHaveLength(opts.trendWeeks + 1);
    expect(t.map((p) => p.sets)).toEqual([1, 0, 0, 2, 3]);
    expect(t[4].window).toEqual(r.current.window);
    expect(r.current.muscles.chest.sets).toBe(3);
    expect(Object.keys(r.trend)).toHaveLength(17);
  });
});

describe('exerciseStats', () => {
  it('epley', () => {
    expect(epley1Rm(100, 1)).toBe(100);
    expect(epley1Rm(100, 3)).toBeCloseTo(110);
  });
  it('best set, last session newest, warm-ups excluded', () => {
    const data = makeData(
      makeSession('old', MON, [
        { exerciseId: 'barbell-bench-press', sets: [{ weightKg: 100, reps: 5 }] },
      ]),
      makeSession('new', MON + 7 * 86_400_000, [
        {
          exerciseId: 'barbell-bench-press',
          sets: [
            { weightKg: 140, reps: 1, isWarmup: true },
            { weightKg: 90, reps: 5, rir: 6 },
          ],
        },
      ]),
    );
    const s = exerciseStats(data, 'barbell-bench-press');
    expect(s.history.map((h) => h.sessionId)).toEqual(['new', 'old']);
    expect(s.lastSession?.sessionId).toBe('new');
    expect(s.estimated1RmKg).toBeCloseTo(epley1Rm(100, 5));
    expect(s.bestSet).toMatchObject({ weightKg: 100, reps: 5 });
    expect(s.lastSession?.sets).toHaveLength(1);
  });
  it('bodyweight without load skips e1RM', () => {
    const data = makeData(
      makeSession('a', MON, [
        {
          exerciseId: 'pull-up',
          sets: [{ reps: 8 }, { reps: 12 }, { completedAt: null, reps: 30 }],
        },
      ]),
    );
    const s = exerciseStats(data, 'pull-up');
    expect(s.estimated1RmKg).toBeUndefined();
    expect(s.bestSet?.reps).toBe(12);
    expect(exerciseStats(data, 'nope').history).toEqual([]);
  });
});

describe('performance', () => {
  it('handles 52 weeks x 5 sessions quickly', () => {
    const data = generateTrainingData({
      weeks: 52,
      sessionsPerWeek: 5,
      startTs: at(2025, 0, 6),
      seed: 42,
    });
    expect(data.sessions).toHaveLength(260);
    const t0 = performance.now();
    analyze(data, at(2025, 11, 20), opts);
    exerciseStats(data, 'barbell-bench-press');
    expect(performance.now() - t0).toBeLessThan(200);
  });
  it('is deterministic', () => {
    const a = generateTrainingData({ weeks: 2, sessionsPerWeek: 3, startTs: 0, seed: 7 });
    const b = generateTrainingData({ weeks: 2, sessionsPerWeek: 3, startTs: 0, seed: 7 });
    expect(a).toEqual(b);
  });
});

describe('cardio credit', () => {
  const WED = at(2026, 2, 4, 12);
  const PREV = at(2026, 1, 25, 12);
  function withCardio(
    base: TrainingData,
    sessionId: string,
    startedAt: number,
    entries: Array<Partial<CardioEntry> & { durationSec: number }>,
    exerciseId = 'running',
  ): TrainingData {
    const seId = `${sessionId}-cardio`;
    return {
      ...base,
      sessions: [...base.sessions, { id: sessionId, startedAt, finishedAt: startedAt + 3_600_000 }],
      sessionExercises: [...base.sessionExercises, { id: seId, sessionId, exerciseId, order: 0 }],
      cardioEntries: [
        ...base.cardioEntries,
        ...entries.map((e, i): CardioEntry => ({
          id: `${seId}-c${i}`,
          sessionExerciseId: seId,
          order: i,
          intensity: 'relaxed',
          completedAt: startedAt + 60_000,
          ...e,
        })),
      ],
    };
  }
  const empty = (): TrainingData => ({ ...makeData(), cardioEntries: [] });

  it('credits 30 min relaxed running as 3 quads sets', () => {
    const data = withCardio(empty(), 'c1', WED, [{ durationSec: 1800 }]);
    const { current } = analyze(data, WED, opts);
    expect(current.muscles.quads.sets).toBe(3);
    expect(current.muscles.glutes.sets).toBe(1.5);
    expect(current.muscles.hamstrings.sets).toBe(1.5);
    expect(current.muscles.calves.sets).toBe(1.5);
    expect(current.muscles.quads.contributions).toContainEqual({
      exerciseId: 'running',
      sets: 3,
      weightedSets: 3,
      minutes: 30,
    });
    expect(current.exercisesDone).toContain('running');
  });
  it('caps at 3 per session exercise', () => {
    const data = withCardio(empty(), 'c1', WED, [{ durationSec: 7200 }]);
    expect(analyze(data, WED, opts).current.muscles.quads.sets).toBe(3);
  });
  it('adds to strength volume', () => {
    const base: TrainingData = {
      ...makeData(
        makeSession('s1', WED, [{ exerciseId: 'barbell-back-squat', sets: [{}, {}, {}] }]),
      ),
      cardioEntries: [],
    };
    const squatQuads = analyze(base, WED, opts).current.muscles.quads.sets;
    expect(squatQuads).toBe(3);
    const data = withCardio(base, 'c1', WED, [{ durationSec: 1800 }]);
    expect(analyze(data, WED, opts).current.muscles.quads.sets).toBe(6);
  });
  it('buckets by the previous week', () => {
    const data = withCardio(empty(), 'c1', PREV, [{ durationSec: 1800 }]);
    const { trend, current } = analyze(data, WED, opts);
    expect(trend.quads[trend.quads.length - 2]!.sets).toBe(3);
    expect(current.muscles.quads.sets).toBe(0);
  });
  it('ignores unticked entries', () => {
    const data = withCardio(empty(), 'c1', WED, [{ durationSec: 1800, completedAt: undefined }]);
    const { current } = analyze(data, WED, opts);
    expect(current.muscles.quads.sets).toBe(0);
    expect(current.exercisesDone).not.toContain('running');
  });
  it('skips a cardio exercise without cardioProfile (corrupt data)', () => {
    const base = empty();
    const data = withCardio(
      {
        ...base,
        exercises: base.exercises.map((e) =>
          e.id === 'running' ? { ...e, cardioProfile: undefined } : e,
        ),
      },
      'c1',
      WED,
      [{ durationSec: 1800 }],
    );
    expect(() => analyze(data, WED, opts)).not.toThrow();
    expect(analyze(data, WED, opts).current.muscles.quads.sets).toBe(0);
  });
});
