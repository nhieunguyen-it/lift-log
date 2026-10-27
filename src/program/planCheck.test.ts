import { describe, expect, it } from 'vitest';
import { exerciseMuscles, exercises, MUSCLE_IDS } from '@/data';
import { DEFAULT_TARGETS } from '@/config/training';
import { planCheck } from './planCheck';
import { BUILT_IN_PROGRAMS } from './templates';
import type { Program } from './types';

const prog = (days: Program['days']): Program => ({
  id: 'p',
  name: 'P',
  builtIn: false,
  days,
  createdAt: 0,
  updatedAt: 0,
});

describe('planCheck', () => {
  it('projects bench press 4 sets (chest 4, front_delts 2, triceps 2)', () => {
    const p = prog([
      { id: 'd', name: 'D', exercises: [{ exerciseId: 'barbell-bench-press', targetSets: 4 }] },
    ]);
    const r = planCheck(p, exercises, exerciseMuscles, DEFAULT_TARGETS);
    expect(r.muscles.chest.sets).toBe(4);
    expect(r.muscles.front_delts.sets).toBe(2);
    expect(r.muscles.triceps.sets).toBe(2);
    expect(r.muscles.quads.sets).toBe(0);
    expect(r.muscles.quads.status).toBe('none');
    expect(r.muscles.chest.status).toBe('below');
    expect(r.muscles.chest.contributions).toEqual([
      { exerciseId: 'barbell-bench-press', weightedSets: 4 },
    ]);
    expect(r.unknownExerciseIds).toEqual([]);
  });

  it('sums across days and exercises', () => {
    const p = prog([
      { id: 'a', name: 'A', exercises: [{ exerciseId: 'barbell-bench-press', targetSets: 4 }] },
      {
        id: 'b',
        name: 'B',
        exercises: [
          { exerciseId: 'barbell-bench-press', targetSets: 4 },
          { exerciseId: 'dip', targetSets: 4 },
        ],
      },
    ]);
    const r = planCheck(p, exercises, exerciseMuscles, DEFAULT_TARGETS);
    // chest: 4 + 4 + dip 0.75*4 = 11; triceps: 2 + 2 + 4 = 8
    expect(r.muscles.chest.sets).toBe(11);
    expect(r.muscles.triceps.sets).toBe(8);
    expect(r.muscles.triceps.status).toBe('building');
    expect(r.muscles.chest.contributions[0]).toEqual({
      exerciseId: 'barbell-bench-press',
      weightedSets: 8,
    });
  });

  it('warns below MEV and above MRV, and reports unknown ids', () => {
    const p = prog([
      {
        id: 'a',
        name: 'A',
        exercises: [
          { exerciseId: 'barbell-bench-press', targetSets: 30 },
          { exerciseId: 'gone', targetSets: 3 },
        ],
      },
    ]);
    const r = planCheck(p, exercises, exerciseMuscles, DEFAULT_TARGETS);
    expect(r.muscles.chest.status).toBe('over');
    expect(r.warnings).toContainEqual({
      muscleId: 'chest',
      kind: 'above_mrv',
      sets: 30,
      threshold: 22,
    });
    expect(r.warnings).toContainEqual({
      muscleId: 'quads',
      kind: 'below_mev',
      sets: 0,
      threshold: 8,
    });
    expect(r.unknownExerciseIds).toEqual(['gone']);
  });
});

describe('built-in templates', () => {
  const seedIds = new Set(exercises.map((e) => e.id));
  it.each(BUILT_IN_PROGRAMS.map((p) => [p.name, p] as const))(
    '%s uses seed ids, hits >= 12 muscles in MAV and none above MRV',
    (_name, p) => {
      expect(p.builtIn).toBe(true);
      for (const d of p.days)
        for (const e of d.exercises) expect(seedIds.has(e.exerciseId)).toBe(true);
      const r = planCheck(p, exercises, exerciseMuscles, DEFAULT_TARGETS);
      const optimal = MUSCLE_IDS.filter((m) => r.muscles[m].status === 'optimal').length;
      expect(optimal).toBeGreaterThanOrEqual(12);
      expect(MUSCLE_IDS.filter((m) => r.muscles[m].status === 'over')).toEqual([]);
      expect(r.warnings.filter((w) => w.kind === 'above_mrv')).toEqual([]);
      expect(r.unknownExerciseIds).toEqual([]);
    },
  );

  it.each(BUILT_IN_PROGRAMS.map((p) => [p.name, p] as const))(
    '%s lands biceps and triceps in MAV with nothing over MRV',
    (_name, p) => {
      const r = planCheck(p, exercises, exerciseMuscles, DEFAULT_TARGETS);
      for (const m of ['biceps', 'triceps'] as const) {
        expect(r.muscles[m].sets, m).toBeGreaterThanOrEqual(12);
        expect(r.muscles[m].sets, m).toBeLessThanOrEqual(18);
        expect(r.muscles[m].status, m).toBe('optimal');
      }
      for (const m of MUSCLE_IDS)
        expect(r.muscles[m].sets, m).toBeLessThanOrEqual(r.muscles[m].target.mrv);
    },
  );

  it('has the expected ids and day counts', () => {
    expect(BUILT_IN_PROGRAMS.map((p) => [p.id, p.days.length])).toEqual([
      ['builtin-full-body', 3],
      ['builtin-upper-lower', 4],
      ['builtin-ppl', 6],
    ]);
  });
});
