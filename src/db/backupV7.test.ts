import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { PROFILES } from '@/config/profiles';
import { NOTE_MAX } from '@/program/edit';
import { bindDb, db } from './db';
import { BACKUP_VERSION, exportData, importData, parseBackup, type Backup } from './backup';
import { ensureSeed } from './seed';
import v6 from './__fixtures__/phase6-export.json';
import v7 from './__fixtures__/phase7-export.json';

async function wipe(): Promise<void> {
  bindDb(PROFILES.legacyDbName);
  await Promise.all(db.tables.map((t) => t.clear()));
  for (const n of await Dexie.getDatabaseNames()) {
    if (n !== PROFILES.registryDbName && n !== PROFILES.legacyDbName) await Dexie.delete(n);
  }
}

afterEach(wipe);

describe('backup v7', () => {
  it('parses the fixture and round-trips both notes', async () => {
    bindDb('lift-log');
    await ensureSeed();
    expect(parseBackup(JSON.stringify(v7)).ok).toBe(true);
    await importData(v7 as unknown as Backup);
    const out = await exportData();
    expect(BACKUP_VERSION).toBe(8);
    expect(out.version).toBe(8);
    expect(out.sessionExercises.find((s) => s.note)?.note).toBe('Pause on the chest');
    expect(out.programs?.[0]?.days[0]?.exercises[0]?.note).toBe('Slow eccentric');
  });

  it('rejects a note over NOTE_MAX', () => {
    const bad = JSON.parse(JSON.stringify(v7));
    bad.sessionExercises[0].note = 'x'.repeat(NOTE_MAX + 1);
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
    const bad2 = JSON.parse(JSON.stringify(v7));
    bad2.programs[0].days[0].exercises[0].note = 'x'.repeat(NOTE_MAX + 1);
    expect(parseBackup(JSON.stringify(bad2)).ok).toBe(false);
  });

  it('still imports v6 with no notes', async () => {
    bindDb('lift-log');
    await ensureSeed();
    expect(parseBackup(JSON.stringify(v6)).ok).toBe(true);
    await importData(v6 as unknown as Backup);
    const rows = await db.sessionExercises.toArray();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.note === undefined)).toBe(true);
  });
});
