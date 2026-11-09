import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { resetDb } from './testUtils';
import * as programs from './programsRepo';
import * as sessions from './sessionsRepo';
import * as setsRepo from './setsRepo';
import * as edit from '@/program/edit';
import type { Program } from '@/program/types';

beforeEach(resetDb);

const DAY = 'legs';
const DAY_MS = 86_400_000;

async function makeProgram(): Promise<Program> {
  const p = await programs.createProgram('Legs');
  return programs.updateProgram(p.id, (x) => {
    let n = edit.addDay(x, { id: DAY, name: 'Legs', exercises: [] });
    n = edit.addExercise(n, DAY, 'barbell-back-squat', 5);
    n = edit.setRepRange(n, DAY, 0, { min: 5, max: 5 });
    n = edit.setMainFocus(n, DAY, 0, true);
    n = edit.addExercise(n, DAY, 'leg-press', 3);
    n = edit.setSystem(n, DAY, 1, 'pyramid_up');
    n = edit.setRepRange(n, DAY, 1, { min: 12, max: 15 });
    n = edit.addExercise(n, DAY, 'lying-leg-curl', 1);
    n = edit.setSystem(n, DAY, 2, 'pitt_force');
    return n;
  });
}

async function sessionExercisesOf(sessionId: string) {
  const rows = await db.sessionExercises.where('sessionId').equals(sessionId).toArray();
  return rows.sort((a, b) => a.order - b.order);
}

async function setsOf(sessionExerciseId: string) {
  return setsRepo.listSets(sessionExerciseId);
}

async function finishWith(
  sessionId: string,
  rows: Record<string, { weightKg?: number; reps: number; isWarmup?: boolean }[]>,
  now: number,
) {
  const ses = await sessionExercisesOf(sessionId);
  for (const se of ses) {
    await db.sets.where('sessionExerciseId').equals(se.id).delete();
    const data = rows[se.exerciseId] ?? [];
    await db.sets.bulkAdd(
      data.map((r, order) => ({
        id: `${se.id}-${order}`,
        sessionExerciseId: se.id,
        order,
        reps: r.reps,
        ...(r.weightKg !== undefined ? { weightKg: r.weightKg } : {}),
        isWarmup: r.isWarmup ?? false,
        completedAt: now,
      })),
    );
  }
  await sessions.finishSession(sessionId, now);
}

describe('startProgramDay training systems', () => {
  it('snapshots system, mainFocus and resolved repRange', async () => {
    const p = await makeProgram();
    const s = await programs.startProgramDay(p.id, DAY);
    const ses = await sessionExercisesOf(s.id);
    expect(ses[0]).toMatchObject({ mainFocus: true, repRange: { min: 5, max: 5 } });
    expect('system' in ses[0]).toBe(false);
    expect(ses[1]).toMatchObject({ system: 'pyramid_up', repRange: { min: 12, max: 15 } });
    expect(ses[2]).toMatchObject({ system: 'pitt_force', repRange: { min: 20, max: 20 } });
  });

  it('first time: reps pre-filled, weight blank', async () => {
    const p = await makeProgram();
    const s = await programs.startProgramDay(p.id, DAY);
    const ses = await sessionExercisesOf(s.id);
    const rows = await setsOf(ses[1].id);
    expect(rows.map((r) => r.reps)).toEqual([15, 14, 12]);
    for (const r of rows) expect('weightKg' in r).toBe(false);
  });

  it('second time: rows pre-filled from the previous session', async () => {
    const p = await makeProgram();
    const t0 = Date.now() - 7 * DAY_MS;
    const s1 = await programs.startProgramDay(p.id, DAY, t0);
    await finishWith(
      s1.id,
      {
        'leg-press': [
          { weightKg: 100, reps: 15 },
          { weightKg: 100, reps: 13 },
          { weightKg: 100, reps: 12 },
        ],
        'barbell-back-squat': Array.from({ length: 5 }, () => ({ weightKg: 100, reps: 5 })),
      },
      t0 + 3_600_000,
    );
    const s2 = await programs.startProgramDay(p.id, DAY, Date.now());
    const ses = await sessionExercisesOf(s2.id);
    const squat = (await setsOf(ses[0].id)).map((r) => ({ weightKg: r.weightKg, reps: r.reps }));
    expect(squat).toEqual(Array.from({ length: 5 }, () => ({ weightKg: 105, reps: 5 })));
    const press = (await setsOf(ses[1].id)).map((r) => ({ weightKg: r.weightKg, reps: r.reps }));
    expect(press).toEqual([
      { weightKg: 105, reps: 15 },
      { weightKg: 100, reps: 14 },
      { weightKg: 105, reps: 12 },
    ]);
  });

  it('warm-up sets in history are ignored', async () => {
    const p = await makeProgram();
    const t0 = Date.now() - 7 * DAY_MS;
    const s1 = await programs.startProgramDay(p.id, DAY, t0);
    await finishWith(
      s1.id,
      {
        'leg-press': [
          { weightKg: 40, reps: 10, isWarmup: true },
          { weightKg: 100, reps: 15 },
          { weightKg: 100, reps: 13 },
          { weightKg: 100, reps: 12 },
        ],
      },
      t0 + 3_600_000,
    );
    const s2 = await programs.startProgramDay(p.id, DAY, Date.now());
    const ses = await sessionExercisesOf(s2.id);
    const press = (await setsOf(ses[1].id)).map((r) => ({ weightKg: r.weightKg, reps: r.reps }));
    expect(press).toEqual([
      { weightKg: 105, reps: 15 },
      { weightKg: 100, reps: 14 },
      { weightKg: 105, reps: 12 },
    ]);
  });

  it('editing the program after start does not change the running snapshot', async () => {
    const p = await makeProgram();
    const s = await programs.startProgramDay(p.id, DAY);
    await programs.updateProgram(p.id, (x) => edit.setSystem(x, DAY, 1, 'progression'));
    const ses = await sessionExercisesOf(s.id);
    expect(ses[1].system).toBe('pyramid_up');
  });

  it('ad-hoc addExercise has no snapshot fields', async () => {
    const s = await sessions.startSession();
    const se = await sessions.addExercise(s.id, 'barbell-back-squat');
    const stored = (await db.sessionExercises.get(se.id))!;
    expect('system' in stored).toBe(false);
    expect('mainFocus' in stored).toBe(false);
    expect('repRange' in stored).toBe(false);
  });

  it('duplicating a program keeps system and mainFocus', async () => {
    const p = await makeProgram();
    const copy = await programs.duplicateProgram(p.id);
    const ex = copy.days.find((d) => d.exercises.length === 3)!.exercises;
    expect(ex[0].mainFocus).toBe(true);
    expect(ex[1].system).toBe('pyramid_up');
    expect(ex[2].system).toBe('pitt_force');
  });
});
