import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROFILES } from '@/config/profiles';
import { LiftLogDB, bindDb, db } from './db';
import { resetDb } from './testUtils';
import * as cardioRepo from './cardioRepo';
import { clampMinutes } from './cardioRepo';
import {
  addExercise,
  deleteSession,
  getSessionDetail,
  removeExercise,
  startSession,
} from './sessionsRepo';

async function mkCard(startedAt: number, exerciseId = 'running') {
  const s = { id: crypto.randomUUID(), startedAt, finishedAt: startedAt + 1000 };
  await db.sessions.add(s);
  const se = await addExercise(s.id, exerciseId);
  return { s, se };
}

beforeEach(async () => {
  bindDb(PROFILES.legacyDbName);
  await resetDb();
});

describe('cardioRepo entries', () => {
  it('addEntry defaults then copies the previous entry', async () => {
    const { se } = await mkCard(1000);
    const a = await cardioRepo.addEntry(se.id);
    expect(a).toMatchObject({ durationSec: 0, intensity: 'relaxed', order: 0 });
    await cardioRepo.updateEntry(a.id, { durationSec: 1800, intensity: 'hard' });
    const b = await cardioRepo.addEntry(se.id);
    expect(b).toMatchObject({ durationSec: 1800, intensity: 'hard', order: 1 });
    expect(b.completedAt).toBeUndefined();
  });

  it('first add in a new session copies the most recent earlier session last entry', async () => {
    const old = await mkCard(1000);
    const e1 = await cardioRepo.addEntry(old.se.id);
    await cardioRepo.updateEntry(e1.id, { durationSec: 600, intensity: 'moderate' });
    const e2 = await cardioRepo.addEntry(old.se.id);
    await cardioRepo.updateEntry(e2.id, { durationSec: 2400, intensity: 'hard' });
    const cur = await mkCard(5000);
    const a = await cardioRepo.addEntry(cur.se.id);
    expect(a).toMatchObject({ durationSec: 2400, intensity: 'hard', order: 0 });
  });

  it('setEntryDone needs a duration', async () => {
    const { se } = await mkCard(1000);
    const a = await cardioRepo.addEntry(se.id);
    await cardioRepo.setEntryDone(a.id, true);
    expect((await db.cardioEntries.get(a.id))?.completedAt).toBeUndefined();
    await cardioRepo.setEntryDone(a.id, true, { durationSec: 1800 });
    const row = await db.cardioEntries.get(a.id);
    expect(row?.completedAt).toBeTypeOf('number');
    expect(row?.durationSec).toBe(1800);
    await cardioRepo.setEntryDone(a.id, false);
    expect((await db.cardioEntries.get(a.id))?.completedAt).toBeUndefined();
  });

  it('updateEntry to 0 duration clears completedAt', async () => {
    const { se } = await mkCard(1000);
    const a = await cardioRepo.addEntry(se.id);
    await cardioRepo.setEntryDone(a.id, true, { durationSec: 600 });
    await cardioRepo.updateEntry(a.id, { durationSec: 0 });
    expect((await db.cardioEntries.get(a.id))?.completedAt).toBeUndefined();
  });

  it('deleteEntry renumbers', async () => {
    const { se } = await mkCard(1000);
    const a = await cardioRepo.addEntry(se.id);
    await cardioRepo.addEntry(se.id);
    await cardioRepo.addEntry(se.id);
    await cardioRepo.deleteEntry(a.id);
    expect((await cardioRepo.listEntries(se.id)).map((e) => e.order)).toEqual([0, 1]);
  });

  it('clampMinutes', () => {
    expect(clampMinutes(0)).toBe(1);
    expect(clampMinutes(900)).toBe(600);
    expect(clampMinutes(29.6)).toBe(30);
  });
});

describe('session integration', () => {
  it('removeExercise and deleteSession cascade to cardio entries', async () => {
    const a = await mkCard(1000);
    await cardioRepo.addEntry(a.se.id);
    await removeExercise(a.se.id);
    expect(await db.cardioEntries.count()).toBe(0);
    const b = await mkCard(2000);
    await cardioRepo.addEntry(b.se.id);
    await cardioRepo.addEntry(b.se.id);
    await deleteSession(b.s.id);
    expect(await db.cardioEntries.count()).toBe(0);
  });

  it('getSessionDetail returns ordered cardio and no sets', async () => {
    const { s, se } = await mkCard(1000);
    await db.cardioEntries.bulkAdd([
      { id: 'b', sessionExerciseId: se.id, order: 1, durationSec: 60, intensity: 'relaxed' },
      { id: 'a', sessionExerciseId: se.id, order: 0, durationSec: 120, intensity: 'hard' },
    ]);
    const d = await getSessionDetail(s.id);
    expect(d?.exercises[0].sets).toEqual([]);
    expect(d?.exercises[0].cardio.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('startSession still works', async () => {
    expect((await startSession()).id).toBeTruthy();
  });
});

describe('getCardioHistory', () => {
  it('is newest first with minutes and estimated distance', async () => {
    for (const t of [1000, 3000, 2000]) {
      const { se } = await mkCard(t);
      await db.cardioEntries.add({
        id: crypto.randomUUID(),
        sessionExerciseId: se.id,
        order: 0,
        durationSec: 1800,
        intensity: 'relaxed',
        completedAt: t,
      });
    }
    const empty = await mkCard(4000);
    await cardioRepo.addEntry(empty.se.id); // uncounted -> omitted
    const h = await cardioRepo.getCardioHistory('running');
    expect(h.map((i) => i.startedAt)).toEqual([3000, 2000, 1000]);
    expect(h[0].minutes).toBe(30);
    expect(h[0].intensity).toBe('relaxed');
    expect(h[0].distanceKm).toBeCloseTo(4.285, 2);
    expect(await cardioRepo.getCardioHistory('running', 2)).toHaveLength(2);
  });

  it('sums distance per entry intensity and reports longest entry intensity', async () => {
    const { se } = await mkCard(1000);
    await db.cardioEntries.bulkAdd([
      {
        id: 'a',
        sessionExerciseId: se.id,
        order: 0,
        durationSec: 600,
        intensity: 'hard',
        completedAt: 1,
      },
      {
        id: 'b',
        sessionExerciseId: se.id,
        order: 1,
        durationSec: 1800,
        intensity: 'relaxed',
        completedAt: 1,
      },
    ]);
    const [h] = await cardioRepo.getCardioHistory('running');
    expect(h.minutes).toBe(40);
    expect(h.intensity).toBe('relaxed');
    const { estimateDistanceKm } = await import('@/analyzer/cardio');
    expect(h.distanceKm).toBeCloseTo(
      (estimateDistanceKm('running', 'hard', 600) ?? 0) +
        (estimateDistanceKm('running', 'relaxed', 1800) ?? 0),
      6,
    );
  });
});

describe('upgrade v2 -> v3', () => {
  it('keeps data and adds empty cardioEntries', async () => {
    const name = `migrate-v3-${crypto.randomUUID()}`;
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
    old.version(2).stores({
      customExercises: 'id, deletedAt',
      customExerciseMuscles: '[exerciseId+muscleId], exerciseId, muscleId',
      programs: 'id, updatedAt',
    });
    await old.table('sessions').add({ id: 's1', startedAt: 1, finishedAt: 2 });
    await old
      .table('sessionExercises')
      .add({ id: 'se1', sessionId: 's1', exerciseId: 'squat', order: 0 });
    await old
      .table('sets')
      .add({ id: 'x', sessionExerciseId: 'se1', order: 0, reps: 5, isWarmup: false });
    old.close();
    const next = new LiftLogDB(name);
    await next.open();
    expect(next.verno).toBe(3);
    expect((await next.sets.get('x'))?.reps).toBe(5);
    expect(await next.cardioEntries.count()).toBe(0);
    next.close();
    await Dexie.delete(name);
  });
});

describe('profiles', () => {
  it('writes to the bound profile db only', async () => {
    const { se } = await mkCard(1000);
    bindDb('lift-log-p2');
    await db.sessions.add({ id: 's9', startedAt: 1 });
    await db.sessionExercises.add({ id: 'se9', sessionId: 's9', exerciseId: 'running', order: 0 });
    await cardioRepo.addEntry('se9');
    expect(await db.cardioEntries.count()).toBe(1);
    bindDb(PROFILES.legacyDbName);
    expect(await db.cardioEntries.where('sessionExerciseId').equals(se.id).count()).toBe(0);
    expect(await db.cardioEntries.count()).toBe(0);
    bindDb('lift-log-p2');
    await Promise.all(db.tables.map((t) => t.clear()));
    bindDb(PROFILES.legacyDbName);
  });
});
