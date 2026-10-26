import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_VERSION, exercises } from '@/data';
import { db } from './db';
import { bundledSeed, ensureSeed } from './seed';
import { getSeedVersion, getUnit, setUnit } from './settingsRepo';
import * as sessions from './sessionsRepo';
import * as sets from './setsRepo';

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
});
