import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_VERSION, exercises } from '@/data';
import { db } from './db';
import { bundledSeed, ensureSeed } from './seed';
import { getSeedVersion, getUnit, setUnit } from './settingsRepo';
import * as sessions from './sessionsRepo';
import * as sets from './setsRepo';
import { createCustomExercise } from './customExercisesRepo';
import { createProgram } from './programsRepo';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('seed loader', () => {
  it('seeds an empty db and records the version', async () => {
    expect(await ensureSeed()).toBe(true);
    expect(await getSeedVersion()).toBe(SEED_VERSION);
    expect(await db.exercises.count()).toBe(exercises.length);
    expect(await db.muscles.count()).toBe(17);
    expect(await db.exerciseMuscles.count()).toBeGreaterThan(0);
  });

  it('does nothing when the stored version is current', async () => {
    await ensureSeed();
    await db.exercises.delete(exercises[0].id);
    expect(await ensureSeed()).toBe(false);
    expect(await db.exercises.count()).toBe(exercises.length - 1);
  });

  it('reseed on version bump replaces seed tables but keeps user data intact', async () => {
    await ensureSeed();
    await setUnit('lbs');
    const s = await sessions.startSession();
    const se = await sessions.addExercise(s.id, exercises[0].id);
    const set = await sets.addSet(se.id);
    await sets.updateSet(set.id, { reps: 5, weightKg: 100 });

    const bumped = {
      ...bundledSeed,
      version: SEED_VERSION + 1,
      exercises: bundledSeed.exercises.slice(0, 10),
      exerciseMuscles: bundledSeed.exerciseMuscles.filter((l) =>
        bundledSeed.exercises.slice(0, 10).some((e) => e.id === l.exerciseId),
      ),
    };
    expect(await ensureSeed(bumped)).toBe(true);

    expect(await getSeedVersion()).toBe(SEED_VERSION + 1);
    expect(await db.exercises.count()).toBe(10);
    expect(await getUnit()).toBe('lbs');
    expect(await db.sessions.count()).toBe(1);
    expect(await db.sessionExercises.count()).toBe(1);
    expect(await db.sets.get(set.id)).toMatchObject({ reps: 5, weightKg: 100 });
  });

  it('v3 -> v4 reseed adds arm isolation + push-up variants and keeps custom exercises/programs', async () => {
    await ensureSeed();
    await db.exercises.bulkDelete(['triceps-pushdown', 'incline-push-up']);
    await db.settings.put({ key: 'seedVersion', value: 3 });
    const customId = await createCustomExercise({
      name: 'Zottman Curl',
      equipment: 'dumbbell',
      force: 'pull',
      mechanic: 'isolation',
      isBodyweight: false,
      muscles: [{ muscleId: 'biceps', weight: 1 }],
    });
    const prog = await createProgram('Mine');

    expect(await ensureSeed()).toBe(true);
    expect(await getSeedVersion()).toBe(SEED_VERSION);
    for (const id of [
      'dumbbell-bicep-curl',
      'cable-curl',
      'triceps-pushdown',
      'cable-overhead-triceps-extension',
      'incline-push-up',
      'decline-push-up',
    ])
      expect(await db.exercises.get(id), id).toBeDefined();
    expect(await db.customExercises.get(customId)).toBeDefined();
    expect(await db.programs.get(prog.id)).toBeDefined();
  });
});
