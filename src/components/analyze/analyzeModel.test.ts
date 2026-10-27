import { describe, expect, it } from 'vitest';
import type { MuscleStatus, MuscleWeek } from '@/analyzer';
import {
  contributionBars,
  deltaText,
  groupMuscles,
  lastWeeks,
  muscleSrText,
  rangeBarGeometry,
  statusBarLabel,
  statusSegments,
  visibleCount,
} from './analyzeModel';

const target = { mev: 8, mavLow: 12, mavHigh: 18, mrv: 22 };
const mw = (id: string, sets: number, status: MuscleStatus = 'none'): MuscleWeek =>
  ({ muscleId: id, sets, status, target, contributions: [] }) as unknown as MuscleWeek;

describe('rangeBarGeometry', () => {
  it('scales to mrv x headroom', () => {
    const g = rangeBarGeometry(10, target, 1.25);
    expect(g.max).toBeCloseTo(27.5);
    expect(g.mrv).toBeCloseTo(80);
    expect(g.mev).toBeCloseTo((8 / 27.5) * 100);
    expect(g.value).toBeCloseTo((10 / 27.5) * 100);
    expect(g.overflow).toBe(false);
  });
  it('clamps values beyond the scale', () => {
    const g = rangeBarGeometry(40, target, 1.25);
    expect(g.value).toBe(100);
    expect(g.overflow).toBe(true);
  });
  it('handles zero', () => {
    expect(rangeBarGeometry(0, target, 1.25).value).toBe(0);
  });
});

describe('text helpers', () => {
  it('builds screen-reader text', () => {
    expect(muscleSrText(mw('chest', 10, 'building'))).toBe(
      'Chest: 10 sets, building, MEV 8, MAV 12–18, MRV 22',
    );
  });
  it('formats deltas', () => {
    expect(deltaText(0)).toBe('Same as last week');
    expect(deltaText(5)).toBe('+5 vs last week');
    expect(deltaText(-2)).toContain('2 vs last week');
  });
});

describe('status segments', () => {
  const counts = { none: 10, below: 2, building: 0, optimal: 5, high: 0, over: 0 };
  it('drops empty statuses and sums to 100', () => {
    const s = statusSegments(counts);
    expect(s.map((x) => x.status)).toEqual(['none', 'below', 'optimal']);
    expect(s.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(100);
    expect(statusBarLabel(counts)).toContain('5 in target range');
  });
});

describe('groupMuscles', () => {
  const list = [mw('quads', 5), mw('chest', 9), mw('abs', 1), mw('lats', 3)];
  it('keeps one flat list by muscle', () => {
    const g = groupMuscles(list, 'muscle', 'name');
    expect(g).toHaveLength(1);
    expect(g[0].muscles.map((m) => m.muscleId)).toEqual(['abs', 'chest', 'lats', 'quads']);
  });
  it('buckets by group in push/pull/legs/core order', () => {
    const g = groupMuscles(list, 'group', 'sets');
    expect(g.map((x) => x.label)).toEqual(['Push', 'Pull', 'Legs', 'Core']);
    expect(g[0].muscles.map((m) => m.muscleId)).toEqual(['chest']);
  });
  it('drops empty groups', () => {
    expect(groupMuscles([mw('chest', 1)], 'group', 'name')).toHaveLength(1);
  });
});

describe('misc', () => {
  it('visibleCount', () => {
    expect(visibleCount(17, 6, false)).toBe(6);
    expect(visibleCount(17, 6, true)).toBe(17);
    expect(visibleCount(3, 6, false)).toBe(3);
  });
  it('contributionBars shares', () => {
    const b = contributionBars([
      { exerciseId: 'a', sets: 3, weightedSets: 3 },
      { exerciseId: 'b', sets: 3, weightedSets: 1 },
    ]);
    expect(b[0].pct).toBe(75);
    expect(contributionBars([])).toEqual([]);
  });
  it('lastWeeks', () => {
    expect(lastWeeks([1, 2, 3, 4, 5, 6], 5)).toEqual([2, 3, 4, 5, 6]);
    expect(lastWeeks([1, 2], 5)).toEqual([1, 2]);
  });
});
