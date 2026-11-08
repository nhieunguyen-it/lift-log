import { describe, it, expect } from 'vitest';
import { exercises, exerciseMuscles, muscles, SEED_VERSION } from './index';
import type { Exercise, ExerciseMuscle } from './index';
import { validateSeed } from './schema';
import { MUSCLE_IDS } from './muscles';
import { VARIANT_CHAINS, nextVariantId } from './variantChains';

describe('seed data', () => {
  it('has a numeric seed version', () => {
    expect(SEED_VERSION).toBe(6);
  });

  it('contains exactly the 17 muscle ids', () => {
    expect(muscles).toHaveLength(17);
    expect(muscles.map((m) => m.id).sort()).toEqual([...MUSCLE_IDS].sort());
  });

  it('has between 60 and 100 exercises', () => {
    expect(exercises.length).toBeGreaterThanOrEqual(60);
    expect(exercises.length).toBeLessThanOrEqual(100);
  });

  it('includes the program-import additions', () => {
    const ids = new Set(exercises.map((e) => e.id));
    for (const id of [
      'lying-leg-curl',
      'dumbbell-fly',
      'barbell-curl',
      'dumbbell-preacher-curl',
      'hammer-curl',
      'lying-triceps-press',
      'seated-dumbbell-triceps-extension',
      'stiff-leg-deadlift',
      'underhand-lat-pulldown',
      'reverse-machine-fly',
    ])
      expect(ids.has(id)).toBe(true);
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

  it('ships the four cardio exercises with profiles', () => {
    const byId = new Map(exercises.map((e) => [e.id, e]));
    expect(byId.get('running')).toMatchObject({ tracking: 'cardio', cardioProfile: 'running' });
    expect(byId.get('cycling-outdoor')).toMatchObject({ cardioProfile: 'cycling' });
    expect(byId.get('swimming-freestyle')).toMatchObject({
      cardioProfile: 'swim-freestyle',
      images: [],
    });
    expect(byId.get('swimming-breaststroke')).toMatchObject({
      cardioProfile: 'swim-breaststroke',
      images: [],
    });
    expect(byId.get('barbell-back-squat')?.tracking).toBe('strength');
  });

  it('maps cardio muscles as reviewed', () => {
    const w = (id: string) =>
      Object.fromEntries(
        exerciseMuscles.filter((l) => l.exerciseId === id).map((l) => [l.muscleId, l.weight]),
      );
    expect(w('running')).toEqual({ quads: 1, glutes: 0.5, hamstrings: 0.5, calves: 0.5 });
    expect(w('cycling-outdoor')).toEqual({ quads: 1, glutes: 0.5, hamstrings: 0.25, calves: 0.25 });
    expect(w('swimming-freestyle')).toEqual({
      lats: 1,
      front_delts: 0.5,
      upper_back: 0.5,
      triceps: 0.25,
      abs: 0.25,
    });
    expect(w('swimming-breaststroke')).toEqual({
      chest: 1,
      quads: 0.5,
      adductors: 0.5,
      lats: 0.5,
      glutes: 0.25,
    });
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
  it('has >= 2 images per strength exercise (>= 1 for static force, 0 for cardio)', () => {
    for (const e of exercises) {
      const min = e.tracking === 'cardio' ? 0 : e.force === 'static' ? 1 : 2;
      expect(e.images.length, e.id).toBeGreaterThanOrEqual(min);
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
    expect(nextVariantId('incline-push-up')).toBe('push-up');
    expect(nextVariantId('push-up')).toBe('decline-push-up');
    expect(nextVariantId('decline-push-up')).toBe('dip');
    expect(nextVariantId('dip')).toBeUndefined();
    expect(nextVariantId('barbell-bench-press')).toBeUndefined();
  });

  it('has no cycles and only bodyweight exercises', () => {
    const byId = new Map(exercises.map((e) => [e.id, e]));
    for (const chain of VARIANT_CHAINS) {
      expect(new Set(chain).size).toBe(chain.length);
      for (const id of chain) expect(byId.get(id)?.isBodyweight, id).toBe(true);
      // following nextVariantId from the start terminates within the chain length
      let cur: string | undefined = chain[0];
      let steps = 0;
      while (cur && steps <= chain.length) {
        cur = nextVariantId(cur);
        steps++;
      }
      expect(cur).toBeUndefined();
    }
  });

  it('orders the push-up chain incline -> push-up -> decline', () => {
    const chain = VARIANT_CHAINS.find((c) => c.includes('push-up'));
    expect(chain?.slice(0, 3)).toEqual(['incline-push-up', 'push-up', 'decline-push-up']);
  });
});

describe('arm isolation exercises (seed v4)', () => {
  const primary = (muscle: string) =>
    exercises.filter(
      (e) =>
        e.mechanic === 'isolation' &&
        exerciseMuscles.some((l) => l.exerciseId === e.id && l.muscleId === muscle && l.weight === 1),
    );
  it('has >= 2 biceps and >= 2 triceps isolation exercises', () => {
    expect(primary('biceps').length).toBeGreaterThanOrEqual(2);
    expect(primary('triceps').length).toBeGreaterThanOrEqual(2);
  });

});

describe('cardio validation', () => {
  const base = { muscles, exercises, exerciseMuscles };

  it('allows 0 images for cardio but not strength', () => {
    const swim = exercises.find((e) => e.id === 'swimming-freestyle');
    expect(swim?.images).toEqual([]);
    expect(() => validateSeed(base)).not.toThrow();
    const squat = exercises.find((e) => e.id === 'barbell-back-squat');
    if (!squat) throw new Error('missing squat');
    const bad = exercises.map((e) => (e === squat ? { ...e, images: e.images.slice(0, 1) } : e));
    expect(() => validateSeed({ ...base, exercises: bad })).toThrow(/need >= 2/);
  });

  it('requires cardioProfile exactly when tracking is cardio', () => {
    const run = exercises.find((e) => e.id === 'running');
    const squat = exercises.find((e) => e.id === 'barbell-back-squat');
    if (!run || !squat) throw new Error('missing exercises');
    const noProfile = exercises.map((e) => (e === run ? { ...e, cardioProfile: undefined } : e));
    expect(() => validateSeed({ ...base, exercises: noProfile })).toThrow(/cardioProfile/);
    const strengthWithProfile = exercises.map((e) =>
      e === squat ? { ...e, cardioProfile: 'running' as const } : e,
    );
    expect(() => validateSeed({ ...base, exercises: strengthWithProfile })).toThrow(/cardioProfile/);
  });
});
