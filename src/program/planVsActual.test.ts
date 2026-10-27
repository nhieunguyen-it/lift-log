import { describe, expect, it } from 'vitest';
import { exerciseMuscles, exercises } from '@/data';
import { DEFAULT_TARGETS } from '@/config/training';
import { analyzeWeek, defaultAnalyzerOptions, weekWindow } from '@/analyzer';
import { makeData, makeSession } from '@/analyzer/fixtures';
import { planCheck } from './planCheck';
import { comparePlanToActual } from './planVsActual';
import type { Program } from './types';

const at = (y: number, m: number, d: number, h = 0) => new Date(y, m, d, h).getTime();
const sets = (n: number) => Array.from({ length: n }, () => ({ reps: 8, rir: 2 }));

const program: Program = {
  id: 'p',
  name: 'P',
  builtIn: false,
  createdAt: 0,
  updatedAt: 0,
  days: [
    {
      id: 'd1',
      name: 'Day 1',
      exercises: [
        { exerciseId: 'barbell-back-squat', targetSets: 4 },
        { exerciseId: 'incline-dumbbell-press', targetSets: 4 },
      ],
    },
    { id: 'd2', name: 'Day 2', exercises: [{ exerciseId: 'pull-up', targetSets: 4 }] },
  ],
};

// Hand-checked: day 1 done with squat cut to 2 sets; day 2 skipped (its session is last week).
const s1 = makeSession('a', at(2026, 2, 3, 18), [
  { exerciseId: 'barbell-back-squat', sets: sets(2) },
  { exerciseId: 'incline-dumbbell-press', sets: sets(4) },
]);
const old = makeSession('old', at(2026, 1, 26, 18), [{ exerciseId: 'pull-up', sets: sets(4) }]);
const data = makeData(s1, old);
const week = analyzeWeek(data, weekWindow(at(2026, 2, 4), 1), defaultAnalyzerOptions());
const plan = planCheck(program, exercises, exerciseMuscles, DEFAULT_TARGETS);
const tagged = [
  { ...s1.sessions[0], programDayId: 'd1' },
  { ...old.sessions[0], programDayId: 'd2' },
];

describe('comparePlanToActual', () => {
  const r = comparePlanToActual(plan, week, program.days, tagged);

  it('lists shortfalls first with planned, actual and gap', () => {
    expect(r.muscles[0]).toEqual({ muscleId: 'lats', planned: 4, actual: 0, gap: -4 });
    expect(r.muscles.slice(1, 4).map((m) => m.muscleId)).toEqual(['biceps', 'quads', 'upper_back']);
    expect(r.muscles.find((m) => m.muscleId === 'glutes')).toEqual({
      muscleId: 'glutes',
      planned: 3,
      actual: 1.5,
      gap: -1.5,
    });
    expect(r.muscles.find((m) => m.muscleId === 'chest')?.gap).toBe(0);
    expect(r.muscles.some((m) => m.muscleId === 'calves')).toBe(false);
    expect(r.muscles).toHaveLength(13);
  });

  it('counts done and skipped days inside the week only', () => {
    expect(r.days).toEqual([
      { dayId: 'd1', name: 'Day 1', done: true },
      { dayId: 'd2', name: 'Day 2', done: false },
    ]);
    expect(r.daysDone).toBe(1);
    expect(r.daysSkipped).toBe(1);
  });
});
