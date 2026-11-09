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

  describe('note', () => {
    const ex = (p: Program, i = 0) => p.days[0].exercises[i];

    it('trims and stores a note', () => {
      expect(ex(edit.setNote(base(), 'a', 0, '  Pyramide ▲  ')).note).toBe('Pyramide ▲');
    });

    it('removes the note key for blank or undefined', () => {
      const withNote = edit.setNote(base(), 'a', 0, 'x');
      expect('note' in ex(edit.setNote(withNote, 'a', 0, '   '))).toBe(false);
      expect('note' in ex(edit.setNote(withNote, 'a', 0, undefined))).toBe(false);
    });

    it('caps the note at NOTE_MAX', () => {
      const r = edit.setNote(base(), 'a', 0, 'a'.repeat(250));
      expect(ex(r).note).toHaveLength(edit.NOTE_MAX);
      expect(edit.NOTE_MAX).toBe(200);
    });

    it('swap keeps note and sets, drops rep range', () => {
      const p = edit.setNote(base(), 'a', 0, 'keep');
      expect(ex(edit.swapExercise(p, 'a', 0, 'q'))).toEqual({
        exerciseId: 'q',
        targetSets: 3,
        note: 'keep',
      });
    });

    it('move, setTargetSets and setRepRange keep the note', () => {
      const p = edit.setNote(base(), 'a', 0, 'keep');
      expect(ex(edit.moveExercise(p, 'a', 0, 'down'), 1).note).toBe('keep');
      expect(ex(edit.setTargetSets(p, 'a', 0, 5)).note).toBe('keep');
      expect(ex(edit.setRepRange(p, 'a', 0, { min: 6, max: 10 })).note).toBe('keep');
      expect(ex(edit.setRepRange(p, 'a', 0, undefined)).note).toBe('keep');
    });
  });

  it('moves, renames and removes days', () => {
    const p = base();
    expect(edit.moveDay(p, 'a', 'down').days.map((d) => d.id)).toEqual(['b', 'a']);
    expect(edit.renameDay(p, 'b', 'Legs').days[1].name).toBe('Legs');
    expect(edit.removeDay(p, 'a').days.map((d) => d.id)).toEqual(['b']);
    expect(edit.addDay(p, { id: 'c', name: 'C', exercises: [] }).days).toHaveLength(3);
  });

  describe('training system', () => {
    const ex = (p: Program, i = 0) => p.days[0].exercises[i];

    it('setSystem stores non-progression systems and clears main focus', () => {
      let p = edit.setMainFocus(base(), 'a', 0, true);
      expect(ex(p).mainFocus).toBe(true);
      p = edit.setSystem(p, 'a', 0, 'pyramid_up');
      expect(ex(p)).toMatchObject({ system: 'pyramid_up' });
      expect('mainFocus' in ex(p)).toBe(false);
    });

    it('setSystem progression deletes the key', () => {
      const p = edit.setSystem(edit.setSystem(base(), 'a', 0, 'pitt_force'), 'a', 0, 'progression');
      expect('system' in ex(p)).toBe(false);
    });

    it('setSystem pitt_force fills an empty rep range with 20-20 and keeps an existing one', () => {
      expect(ex(edit.setSystem(base(), 'a', 1, 'pitt_force'), 1).repRange).toEqual({
        min: 20,
        max: 20,
      });
      expect(ex(edit.setSystem(base(), 'a', 0, 'pitt_force')).repRange).toEqual({
        min: 5,
        max: 8,
      });
    });

    it('setSystem to the current system is a no-op and keeps main focus', () => {
      const on = edit.setMainFocus(base(), 'a', 0, true);
      expect(edit.setSystem(on, 'a', 0, 'progression')).toBe(on);
      const pitt = edit.setSystem(base(), 'a', 0, 'pitt_force');
      expect(edit.setSystem(pitt, 'a', 0, 'pitt_force')).toBe(pitt);
    });

    it('swapExercise keeps system and main focus but drops rep range', () => {
      const pitt = edit.swapExercise(edit.setSystem(base(), 'a', 0, 'pitt_force'), 'a', 0, 'q');
      expect(ex(pitt)).toEqual({ exerciseId: 'q', targetSets: 3, system: 'pitt_force' });
      const mf = edit.swapExercise(edit.setMainFocus(base(), 'a', 0, true), 'a', 0, 'q');
      expect(ex(mf)).toEqual({ exerciseId: 'q', targetSets: 3, mainFocus: true });
    });

    it('setMainFocus is a no-op off progression and false deletes the key', () => {
      const pyr = edit.setSystem(base(), 'a', 0, 'pyramid_down');
      expect(edit.setMainFocus(pyr, 'a', 0, true)).toBe(pyr);
      const on = edit.setMainFocus(base(), 'a', 0, true);
      expect('mainFocus' in ex(edit.setMainFocus(on, 'a', 0, false))).toBe(false);
    });
  });
});
