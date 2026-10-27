import { describe, expect, it } from 'vitest';
import { exerciseMuscles, exercises } from '@/data';
import { DEFAULT_TARGETS, TRAINING } from '@/config/training';
import { blockWeekAt, newBlock, projectBlock, weekSets } from './block';
import type { Program } from './types';

const prog: Program = {
  id: 'p',
  name: 'P',
  builtIn: false,
  createdAt: 0,
  updatedAt: 0,
  days: [
    {
      id: 'a',
      name: 'A',
      exercises: [
        { exerciseId: 'barbell-bench-press', targetSets: 4 },
        { exerciseId: 'barbell-bench-press', targetSets: 3 },
      ],
    },
  ],
};
const data = { exercises, exerciseMuscles, targets: DEFAULT_TARGETS };

describe('newBlock / blockWeekAt', () => {
  const MON = 1; // weekStartsOn Monday
  const wed = new Date(2026, 0, 7, 15).getTime(); // Wed 7 Jan 2026
  it('normalizes startDate to the week start and clamps weeks', () => {
    const b = newBlock(wed, MON, ['x', 'x'], 99);
    expect(new Date(b.startDate).getDay()).toBe(1);
    expect(new Date(b.startDate).getDate()).toBe(5);
    expect(b.weeks).toBe(TRAINING.blocks.maxWeeks);
    expect(b.rampExerciseIds).toEqual(['x']);
    expect(newBlock(wed, MON, [], 1).weeks).toBe(TRAINING.blocks.minWeeks);
    expect(newBlock(wed, MON, []).weeks).toBe(TRAINING.blocks.defaultWeeks);
  });
  it('derives the 1-based week, null before/after', () => {
    const b = newBlock(wed, MON, [], 4);
    const at = (d: number, h = 12) => new Date(2026, 0, d, h).getTime();
    expect(blockWeekAt(b, at(4), MON)).toBeNull(); // Sunday before
    expect(blockWeekAt(b, at(5, 0), MON)).toBe(1);
    expect(blockWeekAt(b, at(11, 23), MON)).toBe(1);
    expect(blockWeekAt(b, at(12), MON)).toBe(2);
    expect(blockWeekAt(b, at(26), MON)).toBe(4);
    expect(blockWeekAt(b, at(33), MON)).toBeNull(); // Mon 2 Feb = week 5
  });
  it('respects a Sunday week start', () => {
    const b = newBlock(wed, 0, [], 3);
    expect(new Date(b.startDate).getDate()).toBe(4);
    expect(blockWeekAt(b, new Date(2026, 0, 11, 9).getTime(), 0)).toBe(2);
  });
});

describe('projectBlock', () => {
  it('ramps chosen exercises and deloads the final week', () => {
    const block = newBlock(0, 1, ['barbell-bench-press'], 5);
    expect([1, 2, 3, 4, 5].map((w) => weekSets(block, w, 'barbell-bench-press', 4))).toEqual([
      4, 5, 6, 7, 2,
    ]);
    expect(weekSets(block, 3, 'other', 4)).toBe(4);
    expect(weekSets(block, 5, 'other', 1)).toBe(1);
  });

  /*
   * Hand-computed: bench press, chest weight 1 per set. Day has 4 + 3 sets of bench (both
   * entries ramp). 5 weeks, ramp +1/wk, cap +3, deload x0.5 (min 1):
   *   W1 4+3=7 chest | W2 5+4=9 | W3 6+5=11 | W4 7+6=13 | W5 round(2)+round(1.5)=2+2=4
   */
  it('projects chest sets per week and MRV warnings', () => {
    const block = newBlock(0, 1, ['barbell-bench-press'], 5);
    const targets = { ...DEFAULT_TARGETS, chest: { ...DEFAULT_TARGETS.chest, mrv: 10 } };
    const pj = projectBlock(prog, block, { ...data, targets });
    expect(pj.weeks.map((w) => w.planCheck.muscles.chest.sets)).toEqual([7, 9, 11, 13, 4]);
    expect(pj.weeks.map((w) => w.deload)).toEqual([false, false, false, false, true]);
    expect(pj.weeks[4].targetRir).toEqual(TRAINING.deload.targetRir);
    expect(pj.weeks[0].targetRir).toBeUndefined();
    expect(pj.weeks[1].exercises).toEqual([
      { dayId: 'a', index: 0, exerciseId: 'barbell-bench-press', sets: 5 },
      { dayId: 'a', index: 1, exerciseId: 'barbell-bench-press', sets: 4 },
    ]);
    expect(pj.mrvWarnings).toEqual([
      { week: 3, muscleId: 'chest', sets: 11, mrv: 10 },
      { week: 4, muscleId: 'chest', sets: 13, mrv: 10 },
    ]);
    // base program untouched
    expect(prog.days[0].exercises[0].targetSets).toBe(4);
  });
});
