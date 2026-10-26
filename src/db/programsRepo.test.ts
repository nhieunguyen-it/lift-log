import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { resetDb } from './testUtils';
import * as programs from './programsRepo';
import * as sessions from './sessionsRepo';
import * as settings from './settingsRepo';
import * as edit from '@/program/edit';

beforeEach(resetDb);

describe('programsRepo', () => {
  it('lists built-ins first and resolves them by id', async () => {
    const list = await programs.listPrograms();
    expect(list.slice(0, 3).map((p) => p.id)).toEqual([
      'builtin-full-body',
      'builtin-upper-lower',
      'builtin-ppl',
    ]);
    expect((await programs.getProgram('builtin-ppl'))?.builtIn).toBe(true);
    expect(await programs.listUserPrograms()).toEqual([]);
  });

  it('duplicates a built-in into an editable copy with fresh ids', async () => {
    const copy = await programs.duplicateProgram('builtin-upper-lower');
    expect(copy.builtIn).toBe(false);
    expect(copy.id).not.toBe('builtin-upper-lower');
    expect(copy.days).toHaveLength(4);
    expect(copy.days[0].id).not.toBe('ul-u1');
    expect(await db.programs.count()).toBe(1);
    await programs.updateProgram(copy.id, (p) => edit.renameProgram(p, 'Mine'));
    expect((await programs.getProgram(copy.id))?.name).toBe('Mine');
  });

  it('rejects editing or deleting built-ins', async () => {
    await expect(programs.updateProgram('builtin-ppl', (p) => p)).rejects.toThrow();
    await expect(programs.deleteProgram('builtin-ppl')).rejects.toThrow();
  });

  it('delete clears the active id; activate validates', async () => {
    const p = await programs.createProgram('X');
    await programs.activateProgram(p.id);
    expect((await programs.getActiveProgram())?.id).toBe(p.id);
    await programs.deleteProgram(p.id);
    expect(await settings.getActiveProgramId()).toBeNull();
    await expect(programs.activateProgram('nope')).rejects.toThrow();
    await programs.activateProgram('builtin-full-body');
    expect((await programs.getActiveProgram())?.name).toContain('Full Body');
  });

  it('startProgramDay creates ordered exercises with blank set rows', async () => {
    const day = (await programs.getProgram('builtin-full-body'))!.days[0];
    const s = await programs.startProgramDay('builtin-full-body', day.id);
    const detail = await sessions.getSessionDetail(s.id);
    expect(detail?.exercises.map((e) => e.sessionExercise.exerciseId)).toEqual(
      day.exercises.map((e) => e.exerciseId),
    );
    detail?.exercises.forEach((e, i) => {
      expect(e.sets).toHaveLength(day.exercises[i].targetSets);
      for (const row of e.sets) {
        expect(row.reps).toBe(0);
        expect(row.weightKg).toBeUndefined();
        expect(row.rir).toBeUndefined();
        expect(row.completedAt).toBeUndefined();
      }
      expect(e.sets.map((r) => r.order)).toEqual(e.sets.map((_, k) => k));
    });
  });

  it('startProgramDay returns an already-active session untouched', async () => {
    const active = await sessions.startSession();
    const day = (await programs.getProgram('builtin-ppl'))!.days[0];
    const s = await programs.startProgramDay('builtin-ppl', day.id);
    expect(s.id).toBe(active.id);
    expect(await db.sessionExercises.count()).toBe(0);
  });

  it('getPlanCheck and swap in a user program', async () => {
    const p = await programs.duplicateProgram('builtin-full-body');
    const check = await programs.getPlanCheck(p.id);
    expect(check?.unknownExerciseIds).toEqual([]);
    const day = p.days[0];
    await programs.swapProgramExercise(p.id, day.id, 0, 'goblet-squat');
    const after = await programs.getProgram(p.id);
    expect(after?.days[0].exercises[0]).toEqual({ exerciseId: 'goblet-squat', targetSets: 4 });
    const alts = await programs.getProgramAlternatives('barbell-back-squat');
    expect(alts.length).toBeGreaterThan(0);
  });
});
