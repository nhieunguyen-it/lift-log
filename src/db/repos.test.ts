import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exercises } from '@/data';
import { db } from './db';
import { resetDb } from './testUtils';
import * as sessions from './sessionsRepo';
import * as sets from './setsRepo';
import * as ex from './exercisesRepo';
import phase1Export from './__fixtures__/phase1-export.json';
import * as backup from './backup';
import * as settingsRepo from './settingsRepo';
import { getUnit, setUnit } from './settingsRepo';

const [A, B, C] = exercises.map((e) => e.id);

beforeEach(resetDb);

async function workout(exIds: string[], start: number, rows: Array<[number, number, boolean?]>) {
  const s = await sessions.startSession(start);
  for (const id of exIds) {
    const se = await sessions.addExercise(s.id, id);
    for (const [w, r, done] of rows) {
      const row = await sets.addSet(se.id);
      await sets.updateSet(row.id, { weightKg: w, reps: r });
      if (done !== false) await sets.setDone(row.id, true);
    }
  }
  await sessions.finishSession(s.id, start + 3_600_000);
  return s;
}

describe('sessions', () => {
  it('allows only one active session; starting again returns it', async () => {
    const a = await sessions.startSession();
    const b = await sessions.startSession();
    expect(b.id).toBe(a.id);
    expect(await db.sessions.count()).toBe(1);
    expect((await sessions.getActiveSession())?.id).toBe(a.id);
    await sessions.finishSession(a.id);
    expect(await sessions.getActiveSession()).toBeUndefined();
    const c = await sessions.startSession();
    expect(c.id).not.toBe(a.id);
  });

  it('adds, reorders and removes exercises', async () => {
    const s = await sessions.startSession();
    const a = await sessions.addExercise(s.id, A);
    const b = await sessions.addExercise(s.id, B);
    const c = await sessions.addExercise(s.id, C);
    const ids = async () =>
      (await sessions.getSessionDetail(s.id))!.exercises.map((e) => e.sessionExercise.id);
    expect(await ids()).toEqual([a.id, b.id, c.id]);
    await sessions.moveExercise(c.id, 'up');
    expect(await ids()).toEqual([a.id, c.id, b.id]);
    await sessions.moveExercise(a.id, 'up'); // no-op at top
    await sessions.moveExercise(b.id, 'down'); // no-op at bottom
    expect(await ids()).toEqual([a.id, c.id, b.id]);
    await sets.addSet(c.id);
    await sessions.removeExercise(c.id);
    expect(await ids()).toEqual([a.id, b.id]);
    expect(await db.sets.count()).toBe(0);
    const orders = (await sessions.getSessionDetail(s.id))!.exercises.map(
      (e) => e.sessionExercise.order,
    );
    expect(orders).toEqual([0, 1]);
  });

  it('finish returns a summary with working sets and volume only', async () => {
    const s = await sessions.startSession(1_000_000);
    const se = await sessions.addExercise(s.id, A);
    const mk = async (w: number, r: number, o: { warm?: boolean; done?: boolean }) => {
      const row = await sets.addSet(se.id);
      await sets.updateSet(row.id, { weightKg: w, reps: r, isWarmup: !!o.warm });
      if (o.done) await sets.setDone(row.id, true);
    };
    await mk(40, 10, { warm: true, done: true }); // excluded: warmup
    await mk(100, 5, { done: true }); // 500
    await mk(100, 5, { done: true }); // 500
    await mk(100, 5, {}); // excluded: not completed
    const summary = await sessions.finishSession(s.id, 1_000_000 + 45 * 60_000);
    expect(summary).toEqual({
      durationMs: 45 * 60_000,
      exerciseCount: 1,
      workingSets: 2,
      volumeKg: 1000,
    });
  });

  it('lists history newest first, finished only', async () => {
    const old = await workout([A], 1_000, [[50, 5]]);
    const newer = await workout([B], 5_000_000, [[60, 5]]);
    await sessions.startSession(9_000_000_000); // active, excluded
    const hist = await sessions.listHistory();
    expect(hist.map((h) => h.session.id)).toEqual([newer.id, old.id]);
    expect(hist[0].summary.volumeKg).toBe(300);
  });

  it('deleteSession cascades', async () => {
    const s = await workout([A, B], 1_000, [[50, 5]]);
    await sessions.deleteSession(s.id);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sessionExercises.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
  });
});

describe('sets', () => {
  it('first set has empty prefill, later sets copy the previous set in session', async () => {
    const s = await sessions.startSession();
    const se = await sessions.addExercise(s.id, A);
    const s1 = await sets.addSet(se.id);
    expect(s1).toMatchObject({ reps: 0, isWarmup: false, order: 0 });
    expect(s1.weightKg).toBeUndefined();
    await sets.updateSet(s1.id, { weightKg: 80, reps: 8, rir: 2 });
    const s2 = await sets.addSet(se.id);
    expect(s2).toMatchObject({ weightKg: 80, reps: 8, rir: 2, order: 1, isWarmup: false });
    expect(s2.completedAt).toBeUndefined();
  });

  it('prefills from the most recent previous session when none in this one', async () => {
    await workout([A], 1_000, [
      [60, 10],
      [60, 9],
    ]);
    await workout([A], 5_000, [
      [70, 6],
      [70, 5],
    ]);
    const s = await sessions.startSession(9_000);
    const se = await sessions.addExercise(s.id, A);
    const first = await sets.addSet(se.id);
    expect(first).toMatchObject({ weightKg: 70, reps: 6 });
    // other exercise has no history
    const se2 = await sessions.addExercise(s.id, B);
    expect((await sets.addSet(se2.id)).reps).toBe(0);
  });

  it('pickPrefill skips warm-ups in previous session', () => {
    const base = { id: 'x', sessionExerciseId: 'y', order: 0, isWarmup: false };
    const prefill = sets.pickPrefill(
      [],
      [
        { ...base, weightKg: 20, reps: 10, isWarmup: true },
        { ...base, weightKg: 100, reps: 5 },
      ],
    );
    expect(prefill).toMatchObject({ weightKg: 100, reps: 5 });
  });

  it('pickPrefill skips a trailing warm-up in the current session', () => {
    const base = { id: 'x', sessionExerciseId: 'y', order: 0, isWarmup: false };
    const prefill = sets.pickPrefill(
      [
        { ...base, weightKg: 100, reps: 5 },
        { ...base, weightKg: 40, reps: 8, isWarmup: true },
      ],
      [],
    );
    expect(prefill).toMatchObject({ weightKg: 100, reps: 5 });
  });

  it('un-ticks a done set when its reps become 0', async () => {
    const s = await sessions.startSession();
    const se = await sessions.addExercise(s.id, A);
    const set = await sets.addSet(se.id);
    await sets.setDone(set.id, true, { reps: 5 });
    await sets.updateSet(set.id, { reps: 0 });
    expect((await db.sets.get(set.id))?.completedAt).toBeUndefined();
    await sets.setDone(set.id, true, { reps: 0 });
    expect((await db.sets.get(set.id))?.completedAt).toBeUndefined();
  });

  it('finishing twice keeps the original finishedAt', async () => {
    const s = await sessions.startSession(1_000);
    await sessions.finishSession(s.id, 2_000);
    await sessions.finishSession(s.id, 9_000);
    expect((await db.sessions.get(s.id))?.finishedAt).toBe(2_000);
  });

  it('duplicates (inserting after), edits, toggles done, deletes and renumbers', async () => {
    const s = await sessions.startSession();
    const se = await sessions.addExercise(s.id, A);
    const a = await sets.addSet(se.id);
    await sets.updateSet(a.id, { weightKg: 50, reps: 5 });
    const b = await sets.addSet(se.id);
    await sets.setDone(a.id, true);
    const dup = await sets.duplicateSet(a.id);
    expect(dup).toMatchObject({ weightKg: 50, reps: 5, order: 1 });
    expect(dup!.completedAt).toBeUndefined();
    let list = await sets.listSets(se.id);
    expect(list.map((r) => r.id)).toEqual([a.id, dup!.id, b.id]);
    expect(list.map((r) => r.order)).toEqual([0, 1, 2]);

    await sets.updateSet(dup!.id, { weightKg: undefined, rir: 3, isWarmup: true });
    const edited = (await db.sets.get(dup!.id))!;
    expect(edited.weightKg).toBeUndefined();
    expect(edited).toMatchObject({ rir: 3, isWarmup: true });

    await sets.setDone(a.id, false);
    expect((await db.sets.get(a.id))!.completedAt).toBeUndefined();

    await sets.deleteSet(dup!.id);
    list = await sets.listSets(se.id);
    expect(list.map((r) => r.id)).toEqual([a.id, b.id]);
    expect(list.map((r) => r.order)).toEqual([0, 1]);
  });
});

describe('exercises repo', () => {
  it('joins muscles and orders recents most-recent-first', async () => {
    const all = await ex.listExercisesWithMuscles();
    expect(all).toHaveLength(exercises.length);
    expect(all[0].muscles[0].weight).toBe(1);
    await workout([A], 1_000, [[1, 1]]);
    await workout([B, C], 5_000, [[1, 1]]);
    expect(await ex.recentExerciseIds()).toEqual([C, B, A]);
  });
});

describe('backup', () => {
  it('roundtrips export -> import and replaces user data', async () => {
    await setUnit('lbs');
    const s = await workout([A, B], 1_000, [[50, 5]]);
    const exported = await backup.exportData(42);
    const text = JSON.stringify(exported);

    // mutate state, then import
    await sessions.deleteSession(s.id);
    await workout([C], 9_000, [[10, 10]]);
    await setUnit('kg');

    const parsed = backup.parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await backup.importData(parsed.data);

    expect(await getUnit()).toBe('lbs');
    const again = await backup.exportData(42);
    expect(again).toEqual(exported);
    expect(await db.exercises.count()).toBe(exercises.length); // seed untouched
  });

  it('rejects invalid input', () => {
    expect(backup.parseBackup('not json').ok).toBe(false);
    expect(backup.parseBackup('{}').ok).toBe(false);
    const bad = {
      app: 'lift-log',
      version: 1,
      exportedAt: 1,
      settings: { unit: 'stone' },
      sessions: [],
      sessionExercises: [],
      sets: [],
    };
    expect(backup.parseBackup(JSON.stringify(bad)).ok).toBe(false);
    const orphan = {
      ...bad,
      settings: { unit: 'kg' },
      sets: [{ id: 's', sessionExerciseId: 'nope', order: 0, reps: 5, isWarmup: false }],
    };
    expect(backup.parseBackup(JSON.stringify(orphan)).ok).toBe(false);
  });

  it('imports a phase-1 (v1) export and keeps phase-2 settings', async () => {
    await settingsRepo.setWeekStartsOn(0);
    await settingsRepo.setEquipment(['barbell', 'bodyweight']);
    const text = JSON.stringify(phase1Export);
    const parsed = backup.parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await backup.importData(parsed.data);
    expect(await getUnit()).toBe('lbs');
    expect(await db.sets.count()).toBe(2);
    expect(await settingsRepo.getWeekStartsOn()).toBe(0);
    expect(await settingsRepo.getEquipment()).toEqual(['barbell', 'bodyweight']);
  });

  it('roundtrips phase-2 settings', async () => {
    await settingsRepo.setWeekStartsOn(0);
    await settingsRepo.setTargetOverrides({ chest: { mev: 6, mavLow: 10, mavHigh: 14, mrv: 18 } });
    await settingsRepo.setEquipment(['dumbbell']);
    const exported = await backup.exportData(1);
    expect(exported.version).toBe(2);
    await settingsRepo.setWeekStartsOn(1);
    await settingsRepo.setTargetOverrides({});
    await settingsRepo.setEquipment(['barbell']);
    await backup.importData(exported);
    expect(await settingsRepo.getWeekStartsOn()).toBe(0);
    expect((await settingsRepo.getTargetOverrides()).chest?.mev).toBe(6);
    expect(await settingsRepo.getEquipment()).toEqual(['dumbbell', 'bodyweight']);
  });
});

describe('phase-2 settings', () => {
  it('defaults and validation', async () => {
    expect(await settingsRepo.getWeekStartsOn()).toBe(1);
    expect(await settingsRepo.getTargetOverrides()).toEqual({});
    expect((await settingsRepo.getEquipment()).length).toBe(8);
    await expect(
      settingsRepo.setTargetOverrides({ chest: { mev: 10, mavLow: 5, mavHigh: 14, mrv: 18 } }),
    ).rejects.toThrow();
    const t = settingsRepo.resolveTargets({ calves: { mev: 1, mavLow: 2, mavHigh: 3, mrv: 4 } });
    expect(t.calves.mev).toBe(1);
    expect(t.chest.mev).toBe(8);
  });
});
