import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { resetDb } from './testUtils';
import {
  CustomExerciseValidationError,
  countLoggedSets,
  createCustomExercise,
  deleteCustomExercise,
  loadMergedExercises,
  resolveExerciseNames,
  updateCustomExercise,
  type CustomExerciseInput,
} from './customExercisesRepo';
import { listExercisesWithMuscles } from './exercisesRepo';
import { DELETED_EXERCISE_NAME } from '@/data/merged';

const base: CustomExerciseInput = {
  name: 'Cable Crunch Variant',
  equipment: 'cable',
  force: 'pull',
  mechanic: 'isolation',
  isBodyweight: false,
  muscles: [
    { muscleId: 'abs', weight: 1 },
    { muscleId: 'obliques', weight: 0.5 },
  ],
};

beforeEach(resetDb);

async function logSet(exerciseId: string) {
  await db.sessions.add({ id: 's1', startedAt: 1, finishedAt: 2 });
  await db.sessionExercises.add({ id: 'se1', sessionId: 's1', exerciseId, order: 0 });
  await db.sets.add({ id: 'x1', sessionExerciseId: 'se1', order: 0, reps: 10, isWarmup: false });
}

describe('validation', () => {
  it.each([
    ['empty name', { ...base, name: '  ' }],
    ['no primary', { ...base, muscles: [{ muscleId: 'abs', weight: 0.5 }] }],
    [
      'two primaries',
      {
        ...base,
        muscles: [
          { muscleId: 'abs', weight: 1 },
          { muscleId: 'obliques', weight: 1 },
        ],
      },
    ],
    [
      'duplicate muscle',
      {
        ...base,
        muscles: [
          { muscleId: 'abs', weight: 1 },
          { muscleId: 'abs', weight: 0.5 },
        ],
      },
    ],
    [
      'weight below 0.25',
      {
        ...base,
        muscles: [
          { muscleId: 'abs', weight: 1 },
          { muscleId: 'obliques', weight: 0.1 },
        ],
      },
    ],
    ['min > max', { ...base, repRange: { min: 12, max: 8 } }],
  ])('rejects %s', async (_n, input) => {
    await expect(createCustomExercise(input as CustomExerciseInput)).rejects.toBeInstanceOf(
      CustomExerciseValidationError,
    );
    expect(await db.customExercises.count()).toBe(0);
  });
});

describe('create / update', () => {
  it('creates row and links, visible in the merged and filterable lists', async () => {
    const id = await createCustomExercise({ ...base, repRange: { min: 6, max: 12 } });
    expect(id).toMatch(/^custom-/);
    const row = await db.customExercises.get(id);
    expect(row).toMatchObject({ source: 'custom', images: [], level: 'beginner', isCustom: true });
    expect(row?.repRange).toEqual({ min: 6, max: 12 });
    const list = await listExercisesWithMuscles();
    expect(list.find((e) => e.exercise.id === id)?.muscles).toHaveLength(2);
  });

  it('update replaces muscles and clears rep range', async () => {
    const id = await createCustomExercise({ ...base, repRange: { min: 6, max: 12 } });
    await updateCustomExercise(id, {
      ...base,
      name: 'Renamed',
      muscles: [{ muscleId: 'chest', weight: 1 }],
    });
    const row = await db.customExercises.get(id);
    expect(row?.name).toBe('Renamed');
    expect(row?.repRange).toBeUndefined();
    expect(await db.customExerciseMuscles.where('exerciseId').equals(id).count()).toBe(1);
  });
});

describe('delete', () => {
  it('hard-deletes without history, leaving no orphan links', async () => {
    const id = await createCustomExercise(base);
    expect(await deleteCustomExercise(id)).toBe('hard');
    expect(await db.customExercises.count()).toBe(0);
    expect(await db.customExerciseMuscles.count()).toBe(0);
    const names = await resolveExerciseNames([id]);
    expect(names.get(id)).toBe(DELETED_EXERCISE_NAME);
  });

  it('soft-deletes with history: tombstone hidden from lists, kept for history', async () => {
    const id = await createCustomExercise(base);
    await logSet(id);
    expect(await countLoggedSets(id)).toBe(1);
    expect(await deleteCustomExercise(id)).toBe('soft');
    expect((await db.customExercises.get(id))?.deletedAt).toBeTypeOf('number');
    expect(await db.customExerciseMuscles.where('exerciseId').equals(id).count()).toBe(2);
    expect((await listExercisesWithMuscles()).some((e) => e.exercise.id === id)).toBe(false);
    const withTombs = await loadMergedExercises(true);
    expect(withTombs.exercises.some((e) => e.id === id)).toBe(true);
    expect((await resolveExerciseNames([id])).get(id)).toBe(base.name);
    await expect(updateCustomExercise(id, base)).rejects.toThrow();
  });
});
