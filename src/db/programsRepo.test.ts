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
  describe('blocks', () => {
    const wed = new Date(2026, 0, 7, 12).getTime(); // Wed; Monday start => week 1 = 5 Jan
    const nextWeek = new Date(2026, 0, 14, 12).getTime();

    it('tags sessions with program/day and omits blockWeek without a block', async () => {
      const day = (await programs.getProgram('builtin-ppl'))!.days[0];
      const s = await programs.startProgramDay('builtin-ppl', day.id, wed);
      expect(s.programId).toBe('builtin-ppl');
      expect(s.programDayId).toBe(day.id);
      expect(s.blockWeek).toBeUndefined();
      const row = await db.sessions.get(s.id);
      expect(row?.programDayId).toBe(day.id);
      expect(row && 'blockWeek' in row).toBe(false);
    });

    it('startBlock defaults ramp to each day first exercise; view reports week', async () => {
      const prog = (await programs.getProgram('builtin-upper-lower'))!;
      const b = await programs.startBlock(prog.id, { now: wed });
      expect(b.rampExerciseIds).toEqual([
        ...new Set(prog.days.map((d) => d.exercises[0].exerciseId)),
      ]);
      expect(b.weeks).toBe(5);
      const v = await programs.getBlockView(prog.id, nextWeek);
      expect(v?.currentWeek).toBe(2);
      expect(v?.projection.weeks).toHaveLength(5);
      expect(await programs.getBlockView('builtin-ppl', wed)).toBeNull();
    });

    it('startProgramDay uses the current block week set counts and tags blockWeek', async () => {
      const prog = (await programs.getProgram('builtin-full-body'))!;
      const day = prog.days[0];
      const first = day.exercises[0];
      await programs.startBlock(prog.id, { now: wed, weeks: 4 });
      const s = await programs.startProgramDay(prog.id, day.id, nextWeek);
      expect(s.blockWeek).toBe(2);
      const detail = await sessions.getSessionDetail(s.id);
      expect(detail?.exercises[0].sets).toHaveLength(first.targetSets + 1);
      expect(detail?.exercises[1].sets).toHaveLength(day.exercises[1].targetSets);
      expect((await db.sessions.get(s.id))?.blockWeek).toBe(2);
    });

    it('deload week halves sets; outside the block uses base sets without blockWeek', async () => {
      const prog = (await programs.getProgram('builtin-full-body'))!;
      const day = prog.days[0];
      await programs.startBlock(prog.id, { now: wed, weeks: 3 });
      const w3 = new Date(2026, 0, 21, 12).getTime();
      const s = await programs.startProgramDay(prog.id, day.id, w3);
      expect(s.blockWeek).toBe(3);
      const d = await sessions.getSessionDetail(s.id);
      expect(d?.exercises[0].sets).toHaveLength(
        Math.max(1, Math.round(day.exercises[0].targetSets / 2)),
      );
      await sessions.finishSession(s.id);
      const after = new Date(2026, 1, 20, 12).getTime();
      const s2 = await programs.startProgramDay(prog.id, day.id, after);
      expect(s2.blockWeek).toBeUndefined();
      const d2 = await sessions.getSessionDetail(s2.id);
      expect(d2?.exercises[0].sets).toHaveLength(day.exercises[0].targetSets);
    });

    it('restartBlock moves start to this week; endBlock removes it', async () => {
      await programs.startBlock('builtin-ppl', { now: wed });
      const r = await programs.restartBlock('builtin-ppl', nextWeek);
      expect(new Date(r.startDate).getDate()).toBe(12);
      expect((await programs.getBlockView('builtin-ppl', nextWeek))?.currentWeek).toBe(1);
      await programs.endBlock('builtin-ppl');
      expect(await settings.getProgramBlocks()).toEqual({});
      await expect(programs.restartBlock('builtin-ppl')).rejects.toThrow();
    });
  });
});
