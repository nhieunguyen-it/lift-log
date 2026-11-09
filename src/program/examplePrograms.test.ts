import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCardio } from '@/analysis';
import { exercises } from '@/data';
import { findUnknownExercises, parseProgramFile } from '@/program';

// Vitest runs in jsdom, where import.meta.url is not a file: URL; tests run from the repo root.
const text = readFileSync(resolve(process.cwd(), 'examples/programs/ppl-alternating.json'), 'utf8');

describe('examples/programs/ppl-alternating.json', () => {
  const res = parseProgramFile(text);

  it('parses', () => {
    expect(res.ok).toBe(true);
  });

  it('references only catalog exercises (catalog drift guard)', () => {
    if (!res.ok) throw new Error(res.errors.join('\n'));
    const known = new Set(exercises.filter((e) => !isCardio(e)).map((e) => e.id));
    expect(findUnknownExercises(res.file, known)).toEqual([]);
  });

  it('has the expected shape', () => {
    if (!res.ok) throw new Error(res.errors.join('\n'));
    const { days } = res.file.program;
    expect(days.map((d) => d.name)).toEqual([
      'Legs #1',
      'Push #1',
      'Pull #1',
      'Legs #2',
      'Push #2',
      'Pull #2',
    ]);
    expect(days.reduce((n, d) => n + d.exercises.length, 0)).toBe(34);
    expect(days[0].exercises[3]).toEqual({
      exerciseId: 'lying-leg-curl',
      sets: 1,
      reps: { min: 20, max: 20 },
      system: 'pitt_force',
      note: 'pause 3–4 s each',
    });
    const pullUp = days[5].exercises[0];
    expect(pullUp.exerciseId).toBe('pull-up');
    expect(pullUp.reps).toBeUndefined();
  });

  it('carries the coach systems', () => {
    if (!res.ok) throw new Error(res.errors.join('\n'));
    const ex = (day: string, id: string) =>
      res.file.program.days.find((d) => d.name === day)?.exercises.find((e) => e.exerciseId === id);
    expect(ex('Legs #1', 'barbell-back-squat')).toMatchObject({
      system: 'progression',
      mainFocus: true,
    });
    expect(ex('Legs #1', 'leg-press')).toMatchObject({ system: 'pyramid_up' });
    expect(ex('Legs #1', 'lying-leg-curl')).toMatchObject({ system: 'pitt_force' });
    expect(ex('Push #1', 'dumbbell-fly')).toMatchObject({ system: 'pyramid_down' });
  });
});
