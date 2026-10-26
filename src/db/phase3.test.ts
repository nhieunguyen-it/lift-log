import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { LiftLogDB, db } from './db';
import { resetDb } from './testUtils';
import { ensureSeed } from './seed';
import * as backup from './backup';
import { loadMergedExercises } from './customExercisesRepo';
import { getActiveProgramId, getDeloadDismissals } from './settingsRepo';
import v1 from './__fixtures__/phase1-export.json';
import v2 from './__fixtures__/phase2-export.json';
import v3 from './__fixtures__/phase3-export.json';

describe('Dexie v1 -> v2 migration', () => {
  it('keeps all v1 data and adds empty v2 tables', async () => {
    const name = `migrate-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores({
      muscles: 'id',
      exercises: 'id, equipment',
      exerciseMuscles: '[exerciseId+muscleId], exerciseId, muscleId',
      sessions: 'id, startedAt, finishedAt',
      sessionExercises: 'id, sessionId, exerciseId, [sessionId+order]',
      sets: 'id, sessionExerciseId, completedAt, [sessionExerciseId+order]',
      settings: 'key',
    });
    await old.table('sessions').add({ id: 's1', startedAt: 1, finishedAt: 2 });
    await old
      .table('sessionExercises')
      .add({ id: 'se1', sessionId: 's1', exerciseId: 'squat', order: 0 });
    await old
      .table('sets')
      .add({
        id: 'x',
        sessionExerciseId: 'se1',
        order: 0,
        reps: 5,
        weightKg: 100,
        isWarmup: false,
      });
    await old.table('settings').bulkAdd([
      { key: 'unit', value: 'lbs' },
      { key: 'seedVersion', value: 2 },
    ]);
    old.close();

    const next = new LiftLogDB(name);
    await next.open();
    expect(next.verno).toBe(2);
    expect(await next.sessions.toArray()).toEqual([{ id: 's1', startedAt: 1, finishedAt: 2 }]);
    expect((await next.sets.get('x'))?.weightKg).toBe(100);
    expect((await next.settings.get('unit'))?.value).toBe('lbs');
    expect(await next.customExercises.count()).toBe(0);
    expect(await next.programs.count()).toBe(0);
    next.close();
    await Dexie.delete(name);
  });
});

describe('custom exercises survive a reseed', () => {
  beforeEach(resetDb);
  it('ensureSeed does not touch custom tables', async () => {
    const r = backup.parseBackup(JSON.stringify(v3));
    if (!r.ok) throw new Error(r.error);
    await backup.importData(r.data);
    await db.settings.put({ key: 'seedVersion', value: 0 });
    expect(await ensureSeed()).toBe(true);
    const merged = await loadMergedExercises();
    expect(merged.exercises.some((e) => e.id === v3.customExercises[0].id)).toBe(true);
    expect(merged.exerciseMuscles.filter((l) => l.exerciseId.startsWith('custom-'))).toHaveLength(
      2,
    );
  });
});

describe('backup v1/v2/v3', () => {
  beforeEach(resetDb);
  it.each([
    ['v1', v1],
    ['v2', v2],
    ['v3', v3],
  ])('imports %s fixture', async (_, file) => {
    const r = backup.parseBackup(JSON.stringify(file));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await backup.importData(r.data);
    expect(await db.sessions.count()).toBe(1);
  });

  it('v3 round-trips programs, custom exercises and dismissals', async () => {
    const r = backup.parseBackup(JSON.stringify(v3));
    if (!r.ok) throw new Error(r.error);
    await backup.importData(r.data);
    expect(await getActiveProgramId()).toBe('p1');
    expect(await getDeloadDismissals()).toEqual({ k1: 1761000000000 });
    const out = await backup.exportData(5);
    expect(out.version).toBe(3);
    expect(out.programs).toEqual(v3.programs);
    expect(out.customExercises).toEqual(v3.customExercises);
    expect(backup.parseBackup(JSON.stringify(out)).ok).toBe(true);
  });

  it('v2 import keeps existing custom exercises and programs', async () => {
    const r3 = backup.parseBackup(JSON.stringify(v3));
    if (!r3.ok) throw new Error(r3.error);
    await backup.importData(r3.data);
    const r2 = backup.parseBackup(JSON.stringify(v2));
    if (!r2.ok) throw new Error(r2.error);
    await backup.importData(r2.data);
    expect(await db.customExercises.count()).toBe(1);
    expect(await db.programs.count()).toBe(1);
  });

  it('rejects custom links to unknown custom exercises', () => {
    const bad = { ...v3, customExercises: [] };
    expect(backup.parseBackup(JSON.stringify(bad)).ok).toBe(false);
  });
});
