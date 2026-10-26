import { describe, expect, it } from 'vitest';
import type { MuscleWeek } from '@/analyzer';
import { distanceFromTarget, fmtSets, sortMuscles } from './muscleSort';

const t = { mev: 8, mavLow: 12, mavHigh: 18, mrv: 22 };
const mk = (muscleId: string, sets: number, status: string) =>
  ({ muscleId, sets, status, target: t, contributions: [] }) as unknown as MuscleWeek;

describe('muscleSort', () => {
  const list = [mk('quads', 14, 'optimal'), mk('chest', 2, 'below'), mk('biceps', 20, 'high')];
  it('sorts by name', () => {
    expect(sortMuscles(list, 'name').map((m) => m.muscleId)).toEqual(['biceps', 'chest', 'quads']);
  });
  it('sorts by sets desc', () => {
    expect(sortMuscles(list, 'sets')[0].muscleId).toBe('biceps');
  });
  it('sorts by status ascending', () => {
    expect(sortMuscles(list, 'status')[0].muscleId).toBe('chest');
  });
  it('sorts by distance from target', () => {
    expect(sortMuscles(list, 'distance')[0].muscleId).toBe('chest');
    expect(distanceFromTarget(list[0])).toBe(0);
  });
  it('formats sets', () => {
    expect(fmtSets(4)).toBe('4');
    expect(fmtSets(4.25)).toBe('4.3');
  });
});

import { allMusclesMapped } from './muscleMapping';
describe('muscleMapping', () => {
  it('covers all 17 muscles', () => expect(allMusclesMapped()).toBe(true));
});
