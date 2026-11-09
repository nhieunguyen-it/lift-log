import { describe, expect, it } from 'vitest';
import { exercises, exerciseMuscles } from '@/data';
import type { MuscleId } from '@/data';
import { TRAINING } from '@/config/training';
import type { RepRange } from '@/config/training';
import type { TrainingSystem } from '@/program/types';
import { nextTarget, repRangeFor } from './index';
import { planReps, planSets, resolveRepRange } from './systems';

const ex = (id: string) => {
  const e = exercises.find((x) => x.id === id);
  if (!e) throw new Error(`missing ${id}`);
  return e;
};
const primary = (id: string): MuscleId[] =>
  exerciseMuscles.filter((m) => m.exerciseId === id && m.weight === 1).map((m) => m.muscleId);

const h = (pairs: Array<[number | undefined, number]>) =>
  pairs.map(([weightKg, reps]) => ({ weightKg, reps }));

const plan = (
  id: string,
  system: TrainingSystem,
  repRange: RepRange,
  sets: number,
  history: ReturnType<typeof h>,
  opts: { unit?: 'kg' | 'lbs'; deloadWeek?: boolean } = {},
) =>
  planSets({
    system,
    repRange,
    sets,
    history,
    exercise: ex(id),
    primaryMuscleIds: primary(id),
    unit: opts.unit ?? 'kg',
    deloadWeek: opts.deloadWeek,
  });

describe('planReps shapes', () => {
  it('descending / ascending', () => {
    expect(planReps('pyramid_up', { min: 6, max: 15 }, 5, [])).toEqual([15, 13, 11, 8, 6]);
    expect(planReps('pyramid_down', { min: 8, max: 12 }, 4, [])).toEqual([8, 9, 11, 12]);
    expect(planReps('pyramid_up', { min: 12, max: 15 }, 3, [])).toEqual([15, 14, 12]);
    expect(planReps('pyramid_up', { min: 8, max: 12 }, 2, [])).toEqual([12, 8]);
    expect(planReps('pyramid_up', { min: 8, max: 12 }, 1, [])).toEqual([12]);
    expect(planReps('pyramid_down', { min: 8, max: 12 }, 1, [])).toEqual([8]);
  });
});
describe('progression', () => {
  const five = (w: number, r: number) => h(Array(5).fill([w, r]));
  it('steps up when every planned set hit the top', () =>
    expect(plan('barbell-back-squat', 'progression', { min: 5, max: 5 }, 5, five(100, 5))).toEqual(
      Array(5).fill({ weightKg: 105, reps: 5 }),
    ));
  it('holds after a miss', () =>
    expect(
      plan(
        'barbell-back-squat',
        'progression',
        { min: 5, max: 5 },
        5,
        h([
          [100, 5],
          [100, 5],
          [100, 5],
          [100, 3],
          [100, 5],
        ]),
      ),
    ).toEqual(Array(5).fill({ weightKg: 100, reps: 5 })));
  it('holds when fewer sets than planned were done', () =>
    expect(
      plan(
        'barbell-back-squat',
        'progression',
        { min: 5, max: 5 },
        5,
        h(Array(3).fill([100, 5])),
      )[0],
    ).toEqual({ weightKg: 100, reps: 5 }));
  it('range: lowest reps + 1, then reset to min after a step', () => {
    expect(
      plan(
        'barbell-bench-press',
        'progression',
        { min: 8, max: 12 },
        3,
        h([
          [60, 10],
          [60, 9],
          [60, 9],
        ]),
      ),
    ).toEqual(Array(3).fill({ weightKg: 60, reps: 10 }));
    expect(
      plan(
        'barbell-bench-press',
        'progression',
        { min: 8, max: 12 },
        3,
        h(Array(3).fill([60, 12])),
      ),
    ).toEqual(Array(3).fill({ weightKg: 62.5, reps: 8 }));
  });
  it('pure bodyweight leaves weight blank', () =>
    expect(
      plan(
        'push-up',
        'progression',
        { min: 8, max: 20 },
        2,
        h([
          [undefined, 12],
          [undefined, 10],
        ]),
      ),
    ).toEqual(Array(2).fill({ reps: 11 })));
  it('no history: reps only', () =>
    expect(plan('barbell-back-squat', 'progression', { min: 5, max: 5 }, 2, [])).toEqual(
      Array(2).fill({ reps: 5 }),
    ));
  it('lbs lands on the same loadable value as nextTarget', () => {
    const hist = five(102.058, 5);
    const t = nextTarget({
      exercise: ex('barbell-back-squat'),
      primaryMuscleIds: primary('barbell-back-squat'),
      history: [{ sessionId: 's', startedAt: 1, sets: hist }],
      unit: 'lbs',
      config: { ...TRAINING, repRangeOverrides: { 'barbell-back-squat': { min: 5, max: 5 } } },
    });
    expect(
      plan('barbell-back-squat', 'progression', { min: 5, max: 5 }, 5, hist, { unit: 'lbs' })[0]
        .weightKg,
    ).toBe(t.weightKg);
  });
  it('deload week never steps', () =>
    expect(
      plan('barbell-back-squat', 'progression', { min: 5, max: 5 }, 5, five(100, 5), {
        deloadWeek: true,
      })[0].weightKg,
    ).toBe(100));
});
describe('pyramids', () => {
  it('▲ steps only the slots that hit their target', () =>
    expect(
      plan(
        'leg-press',
        'pyramid_up',
        { min: 12, max: 15 },
        3,
        h([
          [100, 15],
          [100, 13],
          [100, 12],
        ]),
      ),
    ).toEqual([
      { weightKg: 105, reps: 15 },
      { weightKg: 100, reps: 14 },
      { weightKg: 105, reps: 12 },
    ]));
  it('▼ missing slots step down from the previous planned slot', () =>
    expect(
      plan(
        'dumbbell-fly',
        'pyramid_down',
        { min: 8, max: 12 },
        4,
        h([
          [20, 8],
          [18, 9],
        ]),
      ),
    ).toEqual([
      { weightKg: 21, reps: 8 },
      { weightKg: 19, reps: 9 },
      { weightKg: 18, reps: 11 },
      { weightKg: 17, reps: 12 },
    ]));
  it('▲ missing first slot with no weight → blank, later missing slots stay blank', () =>
    expect(plan('leg-press', 'pyramid_up', { min: 12, max: 15 }, 2, h([[undefined, 15]]))).toEqual([
      { reps: 15 },
      { reps: 12 },
    ]));
  it('deload week holds each slot', () =>
    expect(
      plan(
        'leg-press',
        'pyramid_up',
        { min: 12, max: 15 },
        3,
        h([
          [100, 15],
          [100, 14],
          [100, 12],
        ]),
        { deloadWeek: true },
      ).map((s) => s.weightKg),
    ).toEqual([100, 100, 100]));
});
describe('pitt_force and range resolution', () => {
  it('defaults to 20-20 and progression-style stepping', () => {
    expect(resolveRepRange('pitt_force', undefined, ex('lying-leg-curl'))).toEqual({
      min: 20,
      max: 20,
    });
    expect(resolveRepRange('progression', undefined, ex('barbell-bench-press'))).toEqual(
      repRangeFor(ex('barbell-bench-press')),
    );
    expect(resolveRepRange('pyramid_up', { min: 8, max: 12 }, ex('leg-press'))).toEqual({
      min: 8,
      max: 12,
    });
    expect(plan('lying-leg-curl', 'pitt_force', { min: 20, max: 20 }, 1, h([[40, 20]]))).toEqual([
      { weightKg: 45, reps: 20 },
    ]);
    expect(plan('lying-leg-curl', 'pitt_force', { min: 20, max: 20 }, 1, h([[40, 17]]))).toEqual([
      { weightKg: 40, reps: 20 },
    ]);
  });
});
