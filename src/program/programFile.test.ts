import { describe, expect, it, vi } from 'vitest';
import {
  findUnknownExercises,
  parseProgramFile,
  toProgram,
  uniqueProgramName,
  type ProgramFile,
} from './programFile';

interface Ex {
  exerciseId: string;
  sets: number;
  reps?: { min: number; max: number };
  note?: string;
  [k: string]: unknown;
}
interface Day {
  name: string;
  exercises: Ex[];
}
interface Raw {
  app: string;
  kind: string;
  version: number;
  program: { name: string; days: Day[] };
}

function valid(): Raw {
  return {
    app: 'lift-log',
    kind: 'program',
    version: 1,
    program: {
      name: 'PPL',
      days: [{ name: 'Legs #1', exercises: [{ exerciseId: 'deadlift', sets: 3 }] }],
    },
  };
}
const parse = (o: unknown) => parseProgramFile(JSON.stringify(o));
function errorsOf(o: unknown): string[] {
  const r = parse(o);
  if (r.ok) throw new Error('expected failure');
  return r.errors;
}
/** A one-day "Legs" file whose first exercise is spread with `fields`. */
function withFields(fields: Record<string, unknown>): Raw {
  const raw = valid();
  raw.program.days[0].name = 'Legs';
  raw.program.days[0].exercises[0] = { ...raw.program.days[0].exercises[0], ...fields };
  return raw;
}
function fileOf(o: unknown): ProgramFile {
  const r = parse(o);
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.file;
}

describe('parseProgramFile', () => {
  it('accepts a valid file and trims names and notes', () => {
    const raw = valid();
    raw.program.name = '  PPL  ';
    raw.program.days[0].name = ' Legs ';
    raw.program.days[0].exercises[0].note = '  cue  ';
    const f = fileOf(raw);
    expect(f.program.name).toBe('PPL');
    expect(f.program.days[0].name).toBe('Legs');
    expect(f.program.days[0].exercises[0].note).toBe('cue');
  });

  it('omits a whitespace-only note', () => {
    const raw = valid();
    raw.program.days[0].exercises[0].note = '   ';
    const f = fileOf(raw);
    expect('note' in f.program.days[0].exercises[0]).toBe(false);
    const p = toProgram(f, { programId: 'p', dayIds: ['d'] }, 'PPL', 1);
    expect('note' in p.days[0].exercises[0]).toBe(false);
  });

  it('accepts a leading BOM', () => {
    expect(parseProgramFile('﻿' + JSON.stringify(valid())).ok).toBe(true);
  });

  it('rejects non-JSON', () => {
    expect(parseProgramFile('PK\u0003\u0004binary')).toEqual({
      ok: false,
      errors: ["This file isn't a Lift-Log program file (not valid JSON)."],
    });
  });

  it('detects a backup file', () => {
    expect(errorsOf({ app: 'lift-log', version: 6, sessions: [] })).toEqual([
      'This is a Lift-Log backup. Import it from Settings → Backup.',
    ]);
  });

  it('detects an encrypted backup envelope', () => {
    expect(errorsOf({ app: 'lift-log', format: 'lift-log-encrypted', version: 1, data: 'x' })).toEqual([
      'This is a Lift-Log backup. Import it from Settings → Backup.',
    ]);
  });

  it('names the wrong field for app, kind and version', () => {
    const a = { ...valid(), app: 'other' };
    const k = { ...valid(), kind: 'backup' };
    const v = { ...valid(), version: 2 };
    expect(errorsOf(a)).toHaveLength(1);
    expect(errorsOf(a)[0]).toContain('app');
    expect(errorsOf(k)).toHaveLength(1);
    expect(errorsOf(k)[0]).toContain('kind');
    expect(errorsOf(v)).toHaveLength(1);
    expect(errorsOf(v)[0]).toContain('version');
  });

  it('rejects oversized text before parsing', () => {
    const spy = vi.spyOn(JSON, 'parse');
    expect(parseProgramFile('x'.repeat(256 * 1024 + 1))).toEqual({
      ok: false,
      errors: ['This file is too large (max 256 KB).'],
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  describe('limits', () => {
    const withName = (n: number) => {
      const r = valid();
      r.program.name = 'a'.repeat(n);
      return r;
    };
    const withDays = (n: number) => {
      const r = valid();
      r.program.days = Array.from({ length: n }, (_, i) => ({
        name: `D${i}`,
        exercises: [{ exerciseId: 'x', sets: 3 }],
      }));
      return r;
    };
    const withDayName = (n: number) => {
      const r = valid();
      r.program.days[0].name = 'a'.repeat(n);
      return r;
    };
    const withExercises = (n: number) => {
      const r = valid();
      r.program.days[0].exercises = Array.from({ length: n }, () => ({
        exerciseId: 'x',
        sets: 3,
      }));
      return r;
    };
    const withEx = (patch: Partial<Ex>) => {
      const r = valid();
      r.program.days[0].exercises[0] = { exerciseId: 'x', sets: 3, ...patch };
      return r;
    };

    it.each([
      ['name 60', withName(60), true],
      ['name 61', withName(61), false],
      ['name empty', withName(0), false],
      ['days 14', withDays(14), true],
      ['days 15', withDays(15), false],
      ['days 0', withDays(0), false],
      ['day name 40', withDayName(40), true],
      ['day name 41', withDayName(41), false],
      ['exercises 30', withExercises(30), true],
      ['exercises 31', withExercises(31), false],
      ['exercises 0', withExercises(0), false],
      ['sets 1', withEx({ sets: 1 }), true],
      ['sets 0', withEx({ sets: 0 }), false],
      ['sets 20', withEx({ sets: 20 }), true],
      ['sets 21', withEx({ sets: 21 }), false],
      ['sets 2.5', withEx({ sets: 2.5 }), false],
      ['reps 1-100', withEx({ reps: { min: 1, max: 100 } }), true],
      ['reps min 0', withEx({ reps: { min: 0, max: 5 } }), false],
      ['reps max 101', withEx({ reps: { min: 1, max: 101 } }), false],
      ['reps min > max', withEx({ reps: { min: 8, max: 5 } }), false],
      ['note 200', withEx({ note: 'a'.repeat(200) }), true],
      ['note 201', withEx({ note: 'a'.repeat(201) }), false],
      ['empty exerciseId', withEx({ exerciseId: '' }), false],
    ])('%s', (_label, raw, ok) => {
      expect(parse(raw).ok).toBe(ok);
    });

    it('gives readable messages', () => {
      expect(errorsOf(withEx({ sets: 21 }))).toEqual([
        'Day 1 "Legs #1", exercise 1: sets must be between 1 and 20',
      ]);
    });
  });

  it('reports unknown keys with their exercise', () => {
    const raw = valid();
    raw.program.days[0].exercises[0] = { exerciseId: 'x', sets: 3, set: 5 };
    const errs = errorsOf(raw);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('exercise 1');
    expect(errs[0]).toContain('set');
  });

  it('reports all errors across days', () => {
    const raw = valid();
    raw.program.days = [
      { name: 'A', exercises: [{ exerciseId: 'x', sets: 0 }] },
      {
        name: 'B',
        exercises: [
          { exerciseId: 'x', sets: 3 },
          { exerciseId: 'x', sets: 99 },
        ],
      },
    ];
    const errs = errorsOf(raw);
    expect(errs).toHaveLength(2);
    expect(errs[0]).toMatch(/^Day 1 "A", exercise 1: /);
    expect(errs[1]).toMatch(/^Day 2 "B", exercise 2: /);
  });
});

describe('findUnknownExercises', () => {
  it('lists unknown occurrences', () => {
    const raw = valid();
    raw.program.days[0].exercises = [
      { exerciseId: 'deadlift', sets: 3 },
      { exerciseId: 'leg-curl', sets: 3 },
    ];
    expect(findUnknownExercises(fileOf(raw), new Set(['deadlift']))).toEqual([
      'Day 1 "Legs #1", exercise 2: unknown exercise "leg-curl"',
    ]);
  });
});

describe('uniqueProgramName', () => {
  it('suffixes until unique, case-insensitively', () => {
    expect(uniqueProgramName('PPL', ['ppl', 'PPL (2)'])).toBe('PPL (3)');
  });
  it('stays within the name limit when suffixing a long name', () => {
    const long = 'a'.repeat(60);
    const out = uniqueProgramName(long, [long, `${'a'.repeat(56)} (2)`]);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out).toBe(`${'a'.repeat(56)} (3)`);
  });
  it('keeps a free name', () => {
    expect(uniqueProgramName('PPL', [])).toBe('PPL');
  });
});

describe('toProgram', () => {
  it('converts to a Program', () => {
    const raw = valid();
    raw.program.days = [
      {
        name: 'A',
        exercises: [
          { exerciseId: 'x', sets: 4, reps: { min: 5, max: 8 }, note: 'hi' },
          { exerciseId: 'y', sets: 2 },
        ],
      },
      { name: 'B', exercises: [{ exerciseId: 'z', sets: 1 }] },
    ];
    const p = toProgram(fileOf(raw), { programId: 'pid', dayIds: ['d1', 'd2'] }, 'Name', 42);
    expect(p).toEqual({
      id: 'pid',
      name: 'Name',
      builtIn: false,
      createdAt: 42,
      updatedAt: 42,
      days: [
        {
          id: 'd1',
          name: 'A',
          exercises: [
            { exerciseId: 'x', targetSets: 4, repRange: { min: 5, max: 8 }, note: 'hi' },
            { exerciseId: 'y', targetSets: 2 },
          ],
        },
        { id: 'd2', name: 'B', exercises: [{ exerciseId: 'z', targetSets: 1 }] },
      ],
    });
  });

  const toEx = (fields: Record<string, unknown>) =>
    toProgram(fileOf(withFields(fields)), { programId: 'p', dayIds: ['d'] }, 'X', 0).days[0]
      .exercises[0];

  it('accepts system and mainFocus and normalises to stored form', () => {
    const ex = toEx({ system: 'progression', mainFocus: true });
    expect(ex).toEqual(expect.objectContaining({ mainFocus: true }));
    expect('system' in ex).toBe(false);
  });

  it('accepts mainFocus without a system (progression)', () => {
    const ex = toEx({ mainFocus: true });
    expect(ex).toEqual({ exerciseId: 'deadlift', targetSets: 3, mainFocus: true });
    expect('system' in ex).toBe(false);
  });

  it('maps mainFocus false to absent', () => {
    const ex = toEx({ system: 'pyramid_up', mainFocus: false });
    expect(ex.system).toBe('pyramid_up');
    expect('mainFocus' in ex).toBe(false);
  });
});

describe('program file systems', () => {

  it('rejects an unknown system', () => {
    expect(errorsOf(withFields({ system: 'drop_set' }))).toEqual([
      'Day 1 "Legs", exercise 1: system must be one of progression, pyramid_up, pyramid_down, pitt_force',
    ]);
  });

  it('rejects mainFocus with a non-progression system', () => {
    expect(errorsOf(withFields({ system: 'pitt_force', mainFocus: true }))).toEqual([
      'Day 1 "Legs", exercise 1: mainFocus is only allowed with the progression system',
    ]);
  });
});
