import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { PROFILES } from '@/config/profiles';
import { bindDb, db, getBoundProfileName } from './db';
import { BACKUP_VERSION, exportData, importData, parseBackup, type Backup } from './backup';
import { decryptBackup, encryptBackup, isEncryptedEnvelope } from './backupCrypto';
import { importIntoNewProfile, defaultImportName } from './profileImport';
import { listProfiles, registry, resolveDbName, getActiveProfileId } from './profiles';
import { ensureSeed } from './seed';
import { getFlag } from './settingsRepo';
import v1 from './__fixtures__/phase1-export.json';
import v2 from './__fixtures__/phase2-export.json';
import v3 from './__fixtures__/phase3-export.json';
import v4 from './__fixtures__/phase4-export.json';
import v5 from './__fixtures__/phase5-export.json';

async function wipe(): Promise<void> {
  bindDb(PROFILES.legacyDbName);
  await Promise.all(db.tables.map((t) => t.clear()));
  for (const n of await Dexie.getDatabaseNames()) {
    if (n !== PROFILES.registryDbName && n !== PROFILES.legacyDbName) await Dexie.delete(n);
  }
  await registry.profiles.clear();
  await registry.meta.clear();
}

afterEach(wipe);

const fixtures = { v1, v2, v3, v4, v5 } as const;

describe('backup fixtures', () => {
  it.each(Object.entries(fixtures))('%s fixture parses and imports', async (_n, fx) => {
    bindDb('lift-log');
    await ensureSeed();
    const parsed = parseBackup(JSON.stringify(fx));
    expect(parsed.ok).toBe(true);
    await importData(fx as unknown as Backup);
    expect(await db.sessions.count()).toBe(fx.sessions.length);
    expect(await db.sets.count()).toBe(fx.sets.length);
  });

  it('v5 fixture carries the profile name and current version', () => {
    expect(BACKUP_VERSION).toBe(5);
    expect(v5.version).toBe(5);
    expect(v5.profile).toEqual({ name: 'Fixture Lifter' });
  });
});

describe('profile name in backups', () => {
  it('export includes the bound profile name', async () => {
    bindDb('lift-log-x', 'X');
    expect(getBoundProfileName()).toBe('X');
    const out = await exportData();
    expect(out.version).toBe(5);
    expect(out.profile).toEqual({ name: 'X' });
    expect(parseBackup(JSON.stringify(out)).ok).toBe(true);
    await db.delete();
  });

  it('importing into the current profile ignores profile.name', async () => {
    bindDb('lift-log', 'Current');
    await ensureSeed();
    await importData(v5 as unknown as Backup);
    expect(getBoundProfileName()).toBe('Current');
    expect((await exportData()).profile).toEqual({ name: 'Current' });
    expect(await listProfiles()).toHaveLength(1);
    expect((await listProfiles())[0].name).toBe('Default');
  });
});

describe('importIntoNewProfile', () => {
  it('creates the profile, lands data in the new DB and leaves the previous one untouched', async () => {
    bindDb('lift-log', 'Default');
    await ensureSeed();
    await listProfiles();
    const before = await db.sessions.count();
    const prevSettings = await db.settings.toArray();

    const backup = v5 as unknown as Backup;
    const name = await defaultImportName(backup);
    expect(name).toBe('Fixture Lifter');
    const id = await importIntoNewProfile(backup, name);

    const profiles = await listProfiles();
    expect(profiles.find((p) => p.id === id)?.name).toBe('Fixture Lifter');
    expect(await getActiveProfileId()).toBe(id);
    expect(db.name).toBe(resolveDbName(id));
    expect(getBoundProfileName()).toBe('Fixture Lifter');
    expect(await db.sessions.count()).toBe(v5.sessions.length);
    expect(await getFlag('onboardingDone')).toBe(true);

    bindDb('lift-log', 'Default');
    expect(await db.sessions.count()).toBe(before);
    expect(await db.settings.toArray()).toEqual(prevSettings);
  });

  it('dedupes the default name when taken', async () => {
    bindDb('lift-log', 'Default');
    const backup = v5 as unknown as Backup;
    await importIntoNewProfile(backup, await defaultImportName(backup));
    expect(await defaultImportName(backup)).toBe('Fixture Lifter 2');
  });

  it('cleans up and restores the previous binding when the import fails', async () => {
    bindDb('lift-log', 'Default');
    await ensureSeed();
    const prev = await getActiveProfileId();
    const namesBefore = await Dexie.getDatabaseNames();
    const bad = { ...v5, sessions: [{ nope: true }] } as unknown as Backup;

    await expect(importIntoNewProfile(bad, 'Broken')).rejects.toBeDefined();

    expect((await listProfiles()).map((p) => p.name)).toEqual(['Default']);
    expect(await getActiveProfileId()).toBe(prev);
    expect(db.name).toBe('lift-log');
    expect(getBoundProfileName()).toBe('Default');
    expect((await Dexie.getDatabaseNames()).sort()).toEqual(namesBefore.sort());
  });
});

describe('session pause fields in backups', () => {
  it('roundtrips session pause fields', async () => {
    bindDb('lift-log', 'Default');
    await ensureSeed();
    const session = { id: 's1', startedAt: 0, pausedMs: 1234, pausedAt: 5000 };
    await db.sessions.add(session);
    const exported = await exportData();
    await Promise.all(db.tables.map((t) => t.clear()));
    await ensureSeed();
    await importData(exported);
    expect(await db.sessions.get('s1')).toEqual(session);
  });

  async function importSessions(sessions: object[]): Promise<void> {
    bindDb('lift-log', 'Default');
    await ensureSeed();
    const exported = await exportData();
    const parsed = parseBackup(JSON.stringify({ ...exported, sessions }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await Promise.all(db.tables.map((t) => t.clear()));
    await ensureSeed();
    await importData(parsed.data);
  }

  it('folds an open pause of a finished session into pausedMs on import', async () => {
    await importSessions([
      { id: 's1', startedAt: 0, finishedAt: 10_000, pausedAt: 6_000, pausedMs: 1_000 },
    ]);
    const got = await db.sessions.get('s1');
    expect(got?.pausedMs).toBe(5_000);
    expect(got).not.toHaveProperty('pausedAt');
  });

  it('keeps an open pause on an unfinished session', async () => {
    const session = { id: 's2', startedAt: 0, pausedAt: 6_000, pausedMs: 1_000 };
    await importSessions([session]);
    expect(await db.sessions.get('s2')).toEqual(session);
  });
});

describe('encrypted round-trip (v5)', () => {
  it('encrypts an export and imports the decrypted result', async () => {
    bindDb('lift-log', 'Default');
    await ensureSeed();
    await importData(v5 as unknown as Backup);
    const exported = await exportData();
    const env = await encryptBackup(JSON.stringify(exported), 'secret pass', 1000);
    expect(isEncryptedEnvelope(env)).toBe(true);
    expect(env.data).not.toContain('Fixture');

    const plain = await decryptBackup(env, 'secret pass');
    const parsed = parseBackup(plain);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.version).toBe(5);
    expect(parsed.data.profile).toEqual({ name: 'Default' });

    await Promise.all(db.tables.map((t) => t.clear()));
    await ensureSeed();
    await importData(parsed.data);
    expect(await db.sessions.count()).toBe(v5.sessions.length);
    expect(await db.sets.count()).toBe(v5.sets.length);
  }, 20_000);
});
