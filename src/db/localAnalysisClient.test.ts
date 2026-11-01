import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exercises } from '@/data';
import { DEFAULT_TARGETS } from '@/config/training';
import { db } from './db';
import { resetDb } from './testUtils';
import { loadAnalysisInput } from './localAnalysisClient';
import { setDeloadDismissals, setTargetOverrides, setWeekStartsOn } from './settingsRepo';
import { activateProgram, startBlock } from './programsRepo';
import { createCustomExercise, deleteCustomExercise } from './customExercisesRepo';

const NOW = Date.UTC(2026, 5, 10, 12);

beforeEach(resetDb);

describe('loadAnalysisInput', () => {
  it('loads defaults on an empty profile', async () => {
    const input = await loadAnalysisInput(NOW);
    expect(input.settings.weekStartsOn).toBe(1);
    expect(input.settings.targets).toEqual(DEFAULT_TARGETS);
    expect(input.settings.unit).toBe('kg');
    expect(input.settings.equipment).toContain('bodyweight');
    expect(input.program.active).toBeNull();
    expect(input.program.blocks).toEqual({});
    expect(input.deloadDismissals).toEqual({});
    expect(input.now).toBe(NOW);
    expect(input.data.sessions).toEqual([]);
    expect(input.data.exercises.length).toBe(exercises.length);
  });

  it('loads settings, overrides and a built-in active program', async () => {
    await setWeekStartsOn(0);
    await setTargetOverrides({ chest: { mev: 1, mavLow: 2, mavHigh: 3, mrv: 4 } });
    await activateProgram('builtin-full-body');
    await startBlock('builtin-full-body', { now: NOW });
    await setDeloadDismissals({ k: 5 });
    const input = await loadAnalysisInput(NOW);
    expect(input.settings.weekStartsOn).toBe(0);
    expect(input.settings.targets.chest.mrv).toBe(4);
    expect(input.program.active?.id).toBe('builtin-full-body');
    expect(Object.keys(input.program.blocks)).toEqual(['builtin-full-body']);
    expect(input.deloadDismissals).toEqual({ k: 5 });
  });

  it('keeps tombstoned customs', async () => {
    const id = await createCustomExercise({
      name: 'Odd Lift',
      equipment: 'barbell',
      force: 'push',
      mechanic: 'compound',
      isBodyweight: false,
      muscles: [{ muscleId: 'chest', weight: 1 }],
    });
    await db.sessions.add({ id: 's1', startedAt: NOW - 1000, endedAt: NOW - 500 } as never);
    await db.sessionExercises.add({ id: 'se1', sessionId: 's1', exerciseId: id, order: 0 });
    await db.sets.add({
      id: 'st1',
      sessionExerciseId: 'se1',
      order: 0,
      weightKg: 50,
      reps: 5,
      isWarmup: false,
      completedAt: NOW - 900,
    });
    expect(await deleteCustomExercise(id)).toBe('soft');
    const input = await loadAnalysisInput(NOW);
    expect(typeof input.data.exercises.find((e) => e.id === id)?.deletedAt).toBe('number');
  });
});
