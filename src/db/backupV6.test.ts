import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { PROFILES } from '@/config/profiles';
import { bindDb, db } from './db';
import { BACKUP_VERSION, exportData, importData, parseBackup, type Backup } from './backup';
import * as cardioRepo from './cardioRepo';
import * as sessionsRepo from './sessionsRepo';
import { ensureSeed } from './seed';
import v5 from './__fixtures__/phase5-export.json';
import v6 from './__fixtures__/phase6-export.json';

async function wipe(): Promise<void> {
  bindDb(PROFILES.legacyDbName);
  await Promise.all(db.tables.map((t) => t.clear()));
  for (const n of await Dexie.getDatabaseNames()) {
    if (n !== PROFILES.registryDbName && n !== PROFILES.legacyDbName) await Dexie.delete(n);
  }
}

afterEach(wipe);

async function logRun(): Promise<string> {
  const s = await sessionsRepo.startSession();
  const se = await sessionsRepo.addExercise(s.id, 'running');
  const e = await cardioRepo.addEntry(se.id);
  await cardioRepo.updateEntry(e.id, { durationSec: 1800, intensity: 'relaxed' });
  await cardioRepo.setEntryDone(e.id, true);
  return e.id;
}

describe('backup v6', () => {
  it('exports and re-imports cardio entries', async () => {
    bindDb('lift-log');
    await ensureSeed();
    const id = await logRun();
    const out = await exportData();
    expect(BACKUP_VERSION).toBe(6);
    expect(out.version).toBe(6);
    expect(out.cardioEntries).toHaveLength(1);
    const before = await db.cardioEntries.get(id);
    await db.cardioEntries.clear();
    await importData(JSON.parse(JSON.stringify(out)) as Backup);
    expect(await db.cardioEntries.get(id)).toEqual(before);
    expect(before?.durationSec).toBe(1800);
  });

  it('phase6 fixture parses and imports', async () => {
    bindDb('lift-log');
    await ensureSeed();
    expect(parseBackup(JSON.stringify(v6)).ok).toBe(true);
    await importData(v6 as unknown as Backup);
    expect(await db.cardioEntries.count()).toBe(v6.cardioEntries.length);
    expect(v6.cardioEntries.length).toBeGreaterThan(0);
  });

  it('rejects unknown session exercise and duplicate cardio ids', () => {
    const bad = JSON.parse(JSON.stringify(v6));
    bad.cardioEntries[0].sessionExerciseId = 'nope';
    const r = parseBackup(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cardio entry references unknown exercise entry/);
    const dup = JSON.parse(JSON.stringify(v6));
    dup.cardioEntries.push({ ...dup.cardioEntries[0] });
    const r2 = parseBackup(JSON.stringify(dup));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toMatch(/duplicate ids/);
  });

  it('rejects out-of-range cardio entries', () => {
    const cases: Array<Record<string, unknown>> = [
      { durationSec: 36001 },
      { intensity: 'sprint' },
      { durationSec: -1 },
    ];
    for (const patch of cases) {
      const bad = JSON.parse(JSON.stringify(v6));
      Object.assign(bad.cardioEntries[0], patch);
      expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
    }
    const edge = JSON.parse(JSON.stringify(v6));
    edge.cardioEntries[0].durationSec = 36000;
    expect(parseBackup(JSON.stringify(edge)).ok).toBe(true);
  });

  it('importing a v5 file clears existing cardio entries', async () => {
    bindDb('lift-log');
    await ensureSeed();
    await logRun();
    expect(await db.cardioEntries.count()).toBe(1);
    await importData(v5 as unknown as Backup);
    expect(await db.cardioEntries.count()).toBe(0);
  });
});
