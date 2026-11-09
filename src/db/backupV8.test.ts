import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { bindDb, db } from './db';
import { BACKUP_VERSION, exportData, importData, parseBackup, type Backup } from './backup';
import { getPittSettings, setPittSettings } from './settingsRepo';
import { resetDb } from './testUtils';
import v7 from './__fixtures__/phase7-export.json';

beforeEach(async () => {
  bindDb('lift-log');
  await resetDb();
});

describe('backup v8', () => {
  it('round-trips program systems, session snapshots and PITT settings', async () => {
    const now = Date.now();
    await db.programs.put({
      id: 'p1',
      name: 'P',
      builtIn: false,
      days: [
        {
          id: 'd1',
          name: 'D',
          exercises: [
            { exerciseId: 'e1', targetSets: 3, system: 'pyramid_up' },
            { exerciseId: 'e2', targetSets: 3, mainFocus: true },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
    await db.sessions.put({ id: 's1', startedAt: now });
    await db.sessionExercises.put({
      id: 'se1',
      sessionId: 's1',
      exerciseId: 'e1',
      order: 0,
      system: 'pitt_force',
      mainFocus: true,
      repRange: { min: 20, max: 20 },
    });
    await setPittSettings({ repSec: 3, pauseSec: 5, sound: false });

    const backup = await exportData();
    expect(BACKUP_VERSION).toBe(8);
    expect(backup.version).toBe(8);
    await resetDb();
    await importData(backup);

    const prog = (await db.programs.get('p1'))!;
    expect(prog.days[0].exercises[0].system).toBe('pyramid_up');
    expect(prog.days[0].exercises[1].mainFocus).toBe(true);
    const se = (await db.sessionExercises.get('se1'))!;
    expect(se.system).toBe('pitt_force');
    expect(se.mainFocus).toBe(true);
    expect(se.repRange).toEqual({ min: 20, max: 20 });
    expect(await getPittSettings()).toEqual({ repSec: 3, pauseSec: 5, sound: false });
  });

  it('a v7 backup imports with no systems and default PITT settings', async () => {
    expect(parseBackup(JSON.stringify(v7)).ok).toBe(true);
    await importData(v7 as unknown as Backup);
    const rows = await db.sessionExercises.toArray();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.system === undefined)).toBe(true);
    expect(await getPittSettings()).toEqual({ repSec: 2, pauseSec: 4, sound: true });
  });

  it('rejects a stored "progression" system in a backup', async () => {
    const bad = JSON.parse(JSON.stringify(v7));
    bad.programs[0].days[0].exercises[0].system = 'progression';
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
    const bad2 = JSON.parse(JSON.stringify(v7));
    bad2.sessionExercises[0].system = 'progression';
    expect(parseBackup(JSON.stringify(bad2)).ok).toBe(false);
  });

  it('rejects out-of-range PITT settings', async () => {
    await expect(setPittSettings({ repSec: 11 })).rejects.toThrow();
    const bad = JSON.parse(JSON.stringify(v7));
    bad.version = 8;
    bad.settings.pittRepSec = 0;
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
  });
});
