import { describe, expect, it } from 'vitest';
import * as edit from './edit';
import type { Program } from './types';

const base = (): Program => ({
  id: 'p',
  name: 'P',
  builtIn: false,
  createdAt: 1,
  updatedAt: 1,
  days: [
    {
      id: 'a',
      name: 'A',
      exercises: [
        { exerciseId: 'x', targetSets: 3, repRange: { min: 5, max: 8 } },
        { exerciseId: 'y', targetSets: 3 },
      ],
    },
    { id: 'b', name: 'B', exercises: [] },
  ],
});

describe('program edit helpers', () => {
  it('adds, moves, removes exercises without mutating', () => {
    const p = base();
    const added = edit.addExercise(p, 'b', 'z', 4);
    expect(added.days[1].exercises).toEqual([{ exerciseId: 'z', targetSets: 4 }]);
    expect(p.days[1].exercises).toHaveLength(0);
    const moved = edit.moveExercise(p, 'a', 0, 'down');
    expect(moved.days[0].exercises.map((e) => e.exerciseId)).toEqual(['y', 'x']);
    expect(edit.moveExercise(p, 'a', 0, 'up')).toEqual(p);
    expect(edit.removeExercise(p, 'a', 0).days[0].exercises.map((e) => e.exerciseId)).toEqual([
      'y',
    ]);
  });

  it('clamps target sets and validates rep ranges', () => {
    const p = base();
    expect(edit.setTargetSets(p, 'a', 0, 0).days[0].exercises[0].targetSets).toBe(1);
    expect(edit.setTargetSets(p, 'a', 0, 99).days[0].exercises[0].targetSets).toBe(20);
    expect(edit.setRepRange(p, 'a', 1, { min: 6, max: 10 }).days[0].exercises[1].repRange).toEqual({
      min: 6,
      max: 10,
    });
    expect(edit.setRepRange(p, 'a', 1, { min: 10, max: 6 })).toBe(p);
    expect(edit.setRepRange(p, 'a', 0, undefined).days[0].exercises[0]).toEqual({
      exerciseId: 'x',
      targetSets: 3,
    });
  });

  it('swaps keeping sets, dropping rep range', () => {
    const r = edit.swapExercise(base(), 'a', 0, 'q');
    expect(r.days[0].exercises[0]).toEqual({ exerciseId: 'q', targetSets: 3 });
  });

  it('moves, renames and removes days', () => {
    const p = base();
    expect(edit.moveDay(p, 'a', 'down').days.map((d) => d.id)).toEqual(['b', 'a']);
    expect(edit.renameDay(p, 'b', 'Legs').days[1].name).toBe('Legs');
    expect(edit.removeDay(p, 'a').days.map((d) => d.id)).toEqual(['b']);
    expect(edit.addDay(p, { id: 'c', name: 'C', exercises: [] }).days).toHaveLength(3);
  });
});
