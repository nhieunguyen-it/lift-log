import { describe, it, expect } from 'vitest';
import { exercises, exerciseMuscles, muscles, SEED_VERSION } from './index';
import type { Exercise, ExerciseMuscle } from './index';
import { validateSeed } from './schema';
import { MUSCLE_IDS } from './muscles';
import { VARIANT_CHAINS, nextVariantId } from './variantChains';

describe('seed data', () => {
  it('has a numeric seed version', () => {
    expect(SEED_VERSION).toBe(3);
  });

  it('contains exactly the 17 muscle ids', () => {
    expect(muscles).toHaveLength(17);
    expect(muscles.map((m) => m.id).sort()).toEqual([...MUSCLE_IDS].sort());
  });

  it('has between 60 and 80 exercises', () => {
    expect(exercises.length).toBeGreaterThanOrEqual(60);
    expect(exercises.length).toBeLessThanOrEqual(80);
  });

  it('has unique exercise ids', () => {
    expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length);
  });

  it('has unique muscle ids', () => {
    expect(new Set(muscles.map((m) => m.id)).size).toBe(muscles.length);
  });

  it('only references valid muscle ids', () => {
    const valid = new Set<string>(MUSCLE_IDS);
    for (const l of exerciseMuscles) expect(valid.has(l.muscleId)).toBe(true);
  });

  it('keeps all weights within [0.25, 1.0]', () => {
    for (const l of exerciseMuscles) {
      expect(l.weight).toBeGreaterThanOrEqual(0.25);
      expect(l.weight).toBeLessThanOrEqual(1);
    }
  });

  it('gives every exercise at least one 1.0 primary muscle', () => {
    const primary = new Set(exerciseMuscles.filter((l) => l.weight === 1).map((l) => l.exerciseId));
    for (const e of exercises) expect(primary.has(e.id)).toBe(true);
  });

  it('covers every muscle with at least 2 exercises', () => {
    for (const id of MUSCLE_IDS) {
      const covering = new Set(
        exerciseMuscles.filter((l) => l.muscleId === id).map((l) => l.exerciseId),
      );
      expect(covering.size).toBeGreaterThanOrEqual(2);
    }
  });

  it('references only existing exercises', () => {
    const ids = new Set(exercises.map((e) => e.id));
    for (const l of exerciseMuscles) expect(ids.has(l.exerciseId)).toBe(true);
  });

  it('has no duplicate (exerciseId, muscleId) pairs', () => {
    const keys = exerciseMuscles.map((l) => `${l.exerciseId}::${l.muscleId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('sets isBodyweight true for every bodyweight-equipment exercise', () => {
    for (const e of exercises) {
      if (e.equipment === 'bodyweight') expect(e.isBodyweight).toBe(true);
    }
  });
});

function firstExercise(): Exercise {
  const e = exercises[0];
  if (!e) throw new Error('no exercises in seed');
  return e;
}

function firstLink(): ExerciseMuscle {
  const l = exerciseMuscles[0];
  if (!l) throw new Error('no exerciseMuscles in seed');
  return l;
}

describe('validateSeed', () => {
  const base = {
    muscles: muscles,
    exercises: exercises,
    exerciseMuscles: exerciseMuscles,
  };

  it('accepts the shipped data', () => {
    expect(() => validateSeed(base)).not.toThrow();
  });

  it('rejects duplicate exercise ids', () => {
    expect(() => validateSeed({ ...base, exercises: [...exercises, firstExercise()] })).toThrow(
      /duplicate exercise id/,
    );
  });

  it('rejects an unknown muscle id', () => {
    const bad = [
      ...exerciseMuscles,
      { exerciseId: firstExercise().id, muscleId: 'neck', weight: 1 },
    ];
    expect(() => validateSeed({ ...base, exerciseMuscles: bad })).toThrow();
  });

  it('rejects out-of-range weights', () => {
    const bad = [
      ...exerciseMuscles,
      { exerciseId: firstExercise().id, muscleId: 'calves', weight: 0.1 },
    ];
    expect(() => validateSeed({ ...base, exerciseMuscles: bad })).toThrow();
  });

  it('rejects an exercise without a 1.0 primary', () => {
    const target = firstExercise().id;
    const bad = exerciseMuscles.map((l) =>
      l.exerciseId === target && l.weight === 1 ? { ...l, weight: 0.75 } : l,
    );
    expect(() => validateSeed({ ...base, exerciseMuscles: bad })).toThrow(/no 1\.0 primary/);
  });

  it('rejects links to missing exercises', () => {
    const bad = [
      ...exerciseMuscles,
      { exerciseId: 'does-not-exist', muscleId: 'chest', weight: 1 },
    ];
    expect(() => validateSeed({ ...base, exerciseMuscles: bad })).toThrow(/unknown exercise/);
  });

  it('rejects duplicate (exerciseId, muscleId) pairs', () => {
    expect(() =>
      validateSeed({ ...base, exerciseMuscles: [...exerciseMuscles, firstLink()] }),
    ).toThrow(/duplicate exerciseMuscle/);
  });

  it('rejects a muscle covered by fewer than 2 exercises', () => {
    const bad = exerciseMuscles.filter((l) => l.muscleId !== 'calves');
    expect(() => validateSeed({ ...base, exerciseMuscles: bad })).toThrow(
      /muscle calves covered by 0/,
    );
  });
});

describe('exercise images', () => {
  it('has >= 2 images per exercise (>= 1 for static force)', () => {
    for (const e of exercises) {
      expect(e.images.length, e.id).toBeGreaterThanOrEqual(e.force === 'static' ? 1 : 2);
    }
  });

  it('rejects an exercise with too few images', () => {
    const bad = exercises.map((e, i) => (i === 0 ? { ...e, force: 'push', images: [e.images[0]] } : e));
    expect(() => validateSeed({ muscles, exercises: bad, exerciseMuscles })).toThrow(/image/);
  });

  it('every image file exists in public/', () => {
    const files = new Set(Object.keys(import.meta.glob('/public/exercises/*/*.jpg')));
    for (const e of exercises) {
      for (const img of e.images) {
        expect(files.has(`/public${img}`), img).toBe(true);
      }
    }
  });
});

describe('variant chains', () => {
  const ids = new Set(exercises.map((e) => e.id));

  it('only references existing exercises', () => {
    for (const chain of VARIANT_CHAINS) {
      expect(chain.length).toBeGreaterThanOrEqual(2);
      for (const id of chain) expect(ids.has(id), id).toBe(true);
    }
  });

  it('never puts an id in two chains (or twice in one)', () => {
    const all = VARIANT_CHAINS.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('resolves the next variant and stops at the end of a chain', () => {
    expect(nextVariantId('push-up')).toBe('dip');
    expect(nextVariantId('dip')).toBeUndefined();
    expect(nextVariantId('barbell-bench-press')).toBeUndefined();
  });
});
