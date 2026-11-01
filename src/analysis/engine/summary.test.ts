import { describe, expect, it } from 'vitest';
import { analyzeWeek, defaultAnalyzerOptions, summarizeWeek, weekWindow } from './index';
import { makeData, makeSession } from './fixtures';

const at = (y: number, m: number, d: number, h = 0) => new Date(y, m, d, h).getTime();
const opts = defaultAnalyzerOptions();
const sets = (n: number) => Array.from({ length: n }, () => ({ reps: 8, rir: 2 }));

// Hand-checked: bench 10, squat 6, lateral raise 27 this week; bench 3 last week.
const data = makeData(
  makeSession('prev', at(2026, 1, 24, 18), [{ exerciseId: 'barbell-bench-press', sets: sets(3) }]),
  makeSession('a', at(2026, 2, 3, 18), [
    { exerciseId: 'barbell-bench-press', sets: sets(10) },
    { exerciseId: 'barbell-back-squat', sets: sets(6) },
  ]),
  makeSession('b', at(2026, 2, 5, 18), [{ exerciseId: 'dumbbell-lateral-raise', sets: sets(27) }]),
);
const cur = analyzeWeek(data, weekWindow(at(2026, 2, 4), 1), opts);
const prev = analyzeWeek(data, weekWindow(at(2026, 1, 25), 1), opts);

describe('summarizeWeek', () => {
  it('totals, delta and status counts', () => {
    const s = summarizeWeek(cur, prev);
    expect(s.totalSets).toBe(43);
    expect(s.previousTotalSets).toBe(3);
    expect(s.delta).toBe(40);
    expect(s.statusCounts).toEqual({
      none: 7,
      below: 7,
      building: 2,
      optimal: 0,
      high: 0,
      over: 1,
    });
    expect(s.sessions).toBeUndefined();
  });

  it('needs attention: over first, then below by distance from MEV', () => {
    const s = summarizeWeek(cur, prev);
    expect(s.needsAttention.map((a) => a.muscleId)).toEqual([
      'side_delts',
      'hamstrings',
      'glutes',
      'triceps',
      'quads',
      'upper_back',
      'adductors',
      'lower_back',
    ]);
    expect(s.needsAttention[0]).toEqual({
      muscleId: 'side_delts',
      status: 'over',
      sets: 27,
      threshold: 26,
    });
  });

  it('sessions done vs planned only with a program; no previous week is zero', () => {
    const s = summarizeWeek(cur, undefined, { sessionsDone: 2, plannedSessions: 3 });
    expect(s.sessions).toEqual({ done: 2, planned: 3 });
    expect(s.delta).toBe(43);
  });
});
