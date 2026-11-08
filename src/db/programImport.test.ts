import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PROFILES } from '@/config/profiles';
import { parseProgramFile, type ProgramFile } from '@/program';
import { bindDb, db } from './db';
import { createCustomExercise, deleteCustomExercise } from './customExercisesRepo';
import {
  ProgramImportError,
  createProgram,
  activateProgram,
  importProgram,
  knownProgramExerciseIds,
  previewImportName,
} from './programsRepo';
import { addSet } from './setsRepo';
import * as sessionsRepo from './sessionsRepo';
import { getActiveProgramId } from './settingsRepo';
import { ensureSeed } from './seed';

async function wipe(): Promise<void> {
  bindDb(PROFILES.legacyDbName);
  await Promise.all(db.tables.map((t) => t.clear()));
  for (const n of await Dexie.getDatabaseNames()) {
    if (n !== PROFILES.registryDbName && n !== PROFILES.legacyDbName) await Dexie.delete(n);
  }
}

beforeEach(async () => {
  bindDb('lift-log');
  await ensureSeed();
});
afterEach(wipe);

function file(ids: string[][], name = 'PPL'): ProgramFile {
  const text = JSON.stringify({
    app: 'lift-log',
    kind: 'program',
    version: 1,
    program: {
      name,
      days: ids.map((d, i) => ({
        name: `Day ${i + 1}`,
        exercises: d.map((exerciseId) => ({ exerciseId, sets: 3 })),
      })),
    },
  });
  const r = parseProgramFile(text);
  if (!r.ok) throw new Error(r.errors.join());
  return r.file;
}

describe('importProgram', () => {
  it('adds a program without touching other data', async () => {
    const s = await sessionsRepo.startSession();
    const se = await sessionsRepo.addExercise(s.id, 'deadlift');
    await addSet(se.id);
    const other = await createProgram('Mine');
    await activateProgram(other.id);
    const counts = async () => [await db.sessions.count(), await db.sets.count()];
    const before = await counts();

    const p = await importProgram(file([['deadlift']]));
    expect(await db.programs.count()).toBe(2);
    expect(await counts()).toEqual(before);
    expect(await getActiveProgramId()).toBe(other.id);
    expect(await db.programs.get(other.id)).toEqual(other);
    expect(await db.programs.get(p.id)).toEqual(p);
  });

  it('assigns fresh program and day ids', async () => {
    const f = file([['deadlift'], ['lying-leg-curl']]);
    const a = await importProgram(f);
    const b = await importProgram(f);
    const ids = [a.id, b.id, ...a.days.map((d) => d.id), ...b.days.map((d) => d.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('PPL');
  });

  it('renames on duplicate name', async () => {
    const f = file([['deadlift']]);
    expect(await previewImportName('PPL')).toBe('PPL');
    expect((await importProgram(f)).name).toBe('PPL');
    expect(await previewImportName('PPL')).toBe('PPL (2)');
    expect((await importProgram(f)).name).toBe('PPL (2)');
  });

  it('keeps duplicate exercise ids in order', async () => {
    const p = await importProgram(file([['lying-leg-curl', 'deadlift', 'lying-leg-curl']]));
    expect(p.days[0].exercises.map((e) => e.exerciseId)).toEqual([
      'lying-leg-curl',
      'deadlift',
      'lying-leg-curl',
    ]);
  });

  it('accepts an existing custom exercise, rejects it once hard-deleted', async () => {
    const id = await createCustomExercise({
      name: 'My lift',
      equipment: 'barbell',
      force: 'push',
      mechanic: 'compound',
      isBodyweight: false,
      muscles: [{ muscleId: 'chest', weight: 1 }],
    });
    await importProgram(file([[id]], 'A'));
    expect(await db.programs.count()).toBe(1);
    expect(await deleteCustomExercise(id)).toBe('hard');
    const err = await importProgram(file([[id]], 'B')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProgramImportError);
    expect((err as ProgramImportError).errors.join()).toContain(id);
    expect(await db.programs.count()).toBe(1);
  });

  it('rejects cardio exercises', async () => {
    expect(await knownProgramExerciseIds()).not.toContain('running');
    await expect(importProgram(file([['running']]))).rejects.toBeInstanceOf(ProgramImportError);
    expect(await db.programs.count()).toBe(0);
  });
});
