import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCardio } from '@/analysis';
import { exercises } from '@/data';
import { findUnknownExercises, parseProgramFile } from '@/program';

// Vitest runs in jsdom, where import.meta.url is not a file: URL; tests run from the repo root.
const text = readFileSync(resolve(process.cwd(), 'e2e/data/test-program.json'), 'utf8');

describe('e2e/data/test-program.json', () => {
  const res = parseProgramFile(text);

  it('parses', () => {
    expect(res.ok).toBe(true);
  });

  it('references only catalog exercises (catalog drift guard)', () => {
    if (!res.ok) throw new Error(res.errors.join('\n'));
    const known = new Set(exercises.filter((e) => !isCardio(e)).map((e) => e.id));
    expect(findUnknownExercises(res.file, known)).toEqual([]);
  });

  it('has the shape the e2e specs rely on', () => {
    if (!res.ok) throw new Error(res.errors.join('\n'));
    const { days } = res.file.program;
    expect(days.map((d) => d.name)).toEqual(['Lower', 'Upper']);
    expect(days.reduce((n, d) => n + d.exercises.length, 0)).toBe(6);
    expect(days[0].exercises[3]).toEqual({
      exerciseId: 'lying-leg-curl',
      sets: 1,
      reps: { min: 20, max: 20 },
      system: 'pitt_force',
      note: 'pause 3–4 s each',
    });
    const pullUp = days[1].exercises[0];
    expect(pullUp.exerciseId).toBe('pull-up');
    expect(pullUp.reps).toBeUndefined();
  });

  it('covers every training system', () => {
    if (!res.ok) throw new Error(res.errors.join('\n'));
    const ex = (id: string) => res.file.program.days[0].exercises.find((e) => e.exerciseId === id);
    expect(ex('barbell-back-squat')).toMatchObject({ system: 'progression', mainFocus: true });
    expect(ex('leg-press')).toMatchObject({ system: 'pyramid_up' });
    expect(ex('seated-calf-raise')).toMatchObject({ system: 'pyramid_down' });
    expect(ex('lying-leg-curl')).toMatchObject({ system: 'pitt_force' });
  });
});
