import { describe, expect, it } from 'vitest';
import { TRAINING } from '@/config/training';
import { generateTrainingData, makeData, makeSession } from '@/analyzer/fixtures';
import type { SetSpec } from '@/analyzer/fixtures';
import { longTrend, defaultAnalyzerOptions } from '@/analyzer';
import { detectDeload } from './deload';
import { nextTarget } from './progression';
import { exercises } from '@/data';

const DAY = 86_400_000;
const T0 = new Date(2026, 0, 5, 18).getTime(); // a Monday

/** One exercise, one session per entry (oldest first), 3 identical sets each. */
function history(
  exerciseId: string,
  rows: { w: number; reps: number; rir?: number }[],
  idp: string,
) {
  return rows.map((r, i) => {
    const set: SetSpec = { weightKg: r.w, reps: r.reps, rir: r.rir };
    return makeSession(`${idp}${i}`, T0 + i * 3 * DAY, [{ exerciseId, sets: [set, set, set] }]);
  });
}

describe('detectDeload', () => {
  it('fires on a hand-computed fixture (e1RM drop + RIR/reps down)', () => {
    // A: barbell-bench-press (range 5-10), 100 kg, reps 6,6,5,3 -> e1RM = 100*(1+reps/30):
    //    120, 120, 116.67, 110. peak 120, latest 110, drop = 10/120 = 8.33% >= 5% -> e1rm_drop.
    //    No RIR logged -> (b) not evaluated; misses: only latest session has reps<5 -> 1 < 3.
    // B: barbell-back-squat, 60/65/67.5/70 kg at reps 10/8/7/6, RIR 3/2/1/1:
    //    e1RM 80, 82.33, 83.25, 84 (rising, no drop). RIR avg 3 -> 1 (drop 2 >= 1)
    //    and avg reps 10 -> 6 (falls) -> rir_and_reps_down.
    // 2 flagged >= exercisesForOverall (2) -> overall.
    const a = history(
      'barbell-bench-press',
      [
        { w: 100, reps: 6 },
        { w: 100, reps: 6 },
        { w: 100, reps: 5 },
        { w: 100, reps: 3 },
      ],
      'a',
    );
    const b = history(
      'barbell-back-squat',
      [
        { w: 60, reps: 10, rir: 3 },
        { w: 65, reps: 8, rir: 2 },
        { w: 67.5, reps: 7, rir: 1 },
        { w: 70, reps: 6, rir: 1 },
      ],
      'b',
    );
    const signal = detectDeload(makeData(...a, ...b));
    expect(signal.exercises.map((e) => [e.exerciseId, e.reasons])).toEqual([
      ['barbell-back-squat', ['rir_and_reps_down']],
      ['barbell-bench-press', ['e1rm_drop']],
    ]);
    expect(signal.exercises[1].detail).toBe('e1RM down 8% over 4 sessions');
    expect(signal.overall).toBe(true);
    expect(signal.setsFraction).toBe(TRAINING.deload.setsFraction);
    expect(signal.targetRir).toEqual(TRAINING.deload.targetRir);
    expect(signal.key).toBe('barbell-back-squat,barbell-bench-press@a3');
  });

  it('does not fire on a hand-computed progressing fixture', () => {
    // 100 kg x 6,6,7,8 -> e1RM 120, 120, 123.33, 126.67: latest is the peak (drop 0).
    // Reps rise, no RIR, no sub-5 sets -> nothing flagged; and one exercise is never "overall".
    const a = history(
      'barbell-bench-press',
      [
        { w: 100, reps: 6 },
        { w: 100, reps: 6 },
        { w: 100, reps: 7 },
        { w: 100, reps: 8 },
      ],
      'a',
    );
    const signal = detectDeload(makeData(...a));
    expect(signal.exercises).toEqual([]);
    expect(signal.overall).toBe(false);
  });

  it('flags repeated misses using the progression miss counter', () => {
    // bench 80x8 (e1RM 101.3), then 90x4, 95x4, 100x4 (102, 107.7, 113.3: rising).
    // Last 3 sessions each miss the 5-rep minimum -> misses 3 >= missesToDeload.
    const rows = [
      { w: 80, reps: 8 },
      { w: 90, reps: 4 },
      { w: 95, reps: 4 },
      { w: 100, reps: 4 },
    ];
    const signal = detectDeload(makeData(...history('barbell-bench-press', rows, 'a')));
    expect(signal.exercises).toHaveLength(1);
    expect(signal.exercises[0].reasons).toEqual(['repeated_misses']);
    // Same counter drives progression's deload action.
    const ex = exercises.find((e) => e.id === 'barbell-bench-press')!;
    const hist = rows
      .map((r, i) => ({
        sessionId: `s${i}`,
        startedAt: i,
        sets: [{ weightKg: r.w, reps: r.reps }],
      }))
      .reverse();
    expect(
      nextTarget({ exercise: ex, primaryMuscleIds: ['chest'], history: hist, unit: 'kg' }).action,
    ).toBe('deload');
  });

  it('needs minSessions and does not mutate input', () => {
    const rows = [
      { w: 100, reps: 8 },
      { w: 100, reps: 3 },
    ];
    const data = makeData(...history('barbell-bench-press', rows, 'a'));
    const copy = structuredClone(data);
    expect(detectDeload(data).exercises).toEqual([]);
    expect(data).toEqual(copy);
  });

  it('runs deload detection + 12-week trend over a year of data within 150 ms', () => {
    const data = generateTrainingData({
      weeks: 52,
      sessionsPerWeek: 5,
      startTs: T0 - 52 * 7 * DAY,
      seed: 7,
    });
    const t = performance.now();
    const signal = detectDeload(data);
    const trend = longTrend(data, T0, defaultAnalyzerOptions());
    const ms = performance.now() - t;
    expect(signal.exercises).toBeDefined();
    expect(trend.chest).toHaveLength(TRAINING.longTrendWeeks + 1);
    expect(ms).toBeLessThan(150);
  });
});
