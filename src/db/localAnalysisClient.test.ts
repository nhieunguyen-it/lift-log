import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exercises } from '@/data';
import { DEFAULT_TARGETS } from '@/config/training';
import { db } from './db';
import { resetDb } from './testUtils';
import { liveQuery } from 'dexie';
import { analysisClient, loadAnalysisInput } from './localAnalysisClient';
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

describe('analysisClient', () => {
  it('every client method works on an empty profile', async () => {
    expect((await analysisClient.getAnalyzeView(NOW)).empty).toBe(true);
    await analysisClient.getAnalysis(NOW);
    expect(await analysisClient.getExerciseInsight('nope')).toBeNull();
    await analysisClient.getAlternatives('barbell-bench-press', NOW);
    expect(await analysisClient.getDeloadSignal()).toBeNull();
    await analysisClient.getExerciseDeloadHint('barbell-bench-press', NOW);
    await analysisClient.getLongTrend(NOW);
    expect(await analysisClient.getE1rmHistory('barbell-bench-press')).toEqual([]);
    expect(await analysisClient.getPlanVsActual(NOW)).toBeNull();
  });

  it('re-runs after a write', async () => {
    const seen: number[] = [];
    let notify: () => void = () => {};
    const sub = liveQuery(() => analysisClient.getAnalyzeView(NOW)).subscribe((v) => {
      seen.push(v.summary.totalSets);
      notify();
    });
    const until = (pred: () => boolean) =>
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('no emission')), 5000);
        const check = () => {
          if (pred()) {
            clearTimeout(t);
            resolve();
          }
        };
        notify = check;
        check();
      });
    try {
      await until(() => seen.length >= 1);
      const start = NOW - 1000;
      await db.sessions.add({ id: 'w1', startedAt: start, endedAt: start + 500 } as never);
      await db.sessionExercises.add({
        id: 'wse1',
        sessionId: 'w1',
        exerciseId: 'barbell-bench-press',
        order: 0,
      });
      await db.sets.bulkAdd(
        [0, 1, 2].map((i) => ({
          id: `wst${i}`,
          sessionExerciseId: 'wse1',
          order: i,
          weightKg: 60,
          reps: 8,
          isWarmup: false,
          completedAt: start + i,
        })),
      );
      await until(() => seen.some((n) => n > seen[0]));
      expect(seen[seen.length - 1]).toBeGreaterThan(seen[0]);
    } finally {
      sub.unsubscribe();
    }
  });
});
