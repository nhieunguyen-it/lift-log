import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROFILES } from '@/config/profiles';
import { bindDb, db, getBoundProfileName } from './db';
import {
  ProfileError,
  bootstrapDb,
  createProfile,
  deleteProfile,
  getActiveProfileId,
  listProfiles,
  registry,
  renameProfile,
  resolveDbName,
  setActiveProfileId,
  switchProfile,
} from './profiles';
import { ensureSeed } from './seed';
import {
  getFlag,
  getUnit,
  setUnit,
  getDeloadDismissals,
  setDeloadDismissals,
} from './settingsRepo';
import {
  startSession,
  addExercise,
  getActiveSession,
  listHistory,
  finishSession,
} from './sessionsRepo';
import { addSet, listSets } from './setsRepo';
import { createProgram, listUserPrograms } from './programsRepo';
import { createCustomExercise, loadMergedExercises } from './customExercisesRepo';
import { importData } from './backup';
import v4 from './__fixtures__/phase4-export.json';
import type { Backup } from './backup';

async function wipe(): Promise<void> {
  bindDb(PROFILES.legacyDbName);
  await Promise.all(db.tables.map((t) => t.clear()));
  for (const n of await Dexie.getDatabaseNames()) {
    if (n !== PROFILES.registryDbName && n !== PROFILES.legacyDbName) await Dexie.delete(n);
  }
  await registry.profiles.clear();
  await registry.meta.clear();
}

afterEach(async () => {
  vi.restoreAllMocks();
  await wipe();
});

const customInput = (name: string) => ({
  name,
  equipment: 'barbell' as const,
  force: 'push' as const,
  mechanic: 'compound' as const,
  isBodyweight: false,
  muscles: [{ muscleId: 'chest' as const, weight: 1 }],
});

describe('registry', () => {
  it('lazily creates the Default entry on first read', async () => {
    expect(await registry.profiles.count()).toBe(0);
    const list = await listProfiles();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: PROFILES.defaultId, name: PROFILES.defaultName });
    expect(await getActiveProfileId()).toBe(PROFILES.defaultId);
    // Reading again does not duplicate.
    expect(await listProfiles()).toHaveLength(1);
  });

  it('maps ids to database names', () => {
    expect(resolveDbName('default')).toBe('lift-log');
    expect(resolveDbName('abc')).toBe('lift-log-p-abc');
  });

  it('persists the active id in the registry', async () => {
    const p = await createProfile('Alex');
    await setActiveProfileId(p.id);
    expect(await getActiveProfileId()).toBe(p.id);
    expect((await registry.meta.get('activeProfileId'))?.value).toBe(p.id);
    await expect(setActiveProfileId('nope')).rejects.toThrow('Unknown profile.');
  });

  it('create validates names and rotates colours', async () => {
    const a = await createProfile('  Alex ');
    expect(a.name).toBe('Alex');
    await expect(createProfile('alex')).rejects.toBeInstanceOf(ProfileError);
    await expect(createProfile('a/b')).rejects.toBeInstanceOf(ProfileError);
    const b = await createProfile('Sam');
    expect(new Set([PROFILES.colors[0], a.color, b.color]).size).toBe(3);
  });

  it('enforces the maximum number of profiles', async () => {
    for (let i = 1; i < PROFILES.max; i++) await createProfile(`P${i}`);
    expect(await listProfiles()).toHaveLength(PROFILES.max);
    await expect(createProfile('One more')).rejects.toBeInstanceOf(ProfileError);
  });

  it('renames, allowing re-case but not collisions', async () => {
    const a = await createProfile('Alex');
    await createProfile('Sam');
    expect((await renameProfile(a.id, 'ALEX')).name).toBe('ALEX');
    await expect(renameProfile(a.id, 'sam')).rejects.toBeInstanceOf(ProfileError);
    await expect(renameProfile('nope', 'Zed')).rejects.toBeInstanceOf(ProfileError);
    expect((await listProfiles()).map((p) => p.name)).toContain('ALEX');
  });

  it('refuses to delete the active profile and the only profile', async () => {
    await expect(deleteProfile(PROFILES.defaultId)).rejects.toBeInstanceOf(ProfileError);
    const a = await createProfile('Alex');
    await setActiveProfileId(a.id);
    await expect(deleteProfile(a.id)).rejects.toBeInstanceOf(ProfileError);
    await expect(deleteProfile('nope')).rejects.toBeInstanceOf(ProfileError);
    expect(await listProfiles()).toHaveLength(2);
  });

  it('does not resurrect a deleted Default profile', async () => {
    const a = await createProfile('Alex');
    await setActiveProfileId(a.id);
    await deleteProfile(PROFILES.defaultId);
    const list = await listProfiles();
    expect(list.map((p) => p.id)).toEqual([a.id]);
    expect(await getActiveProfileId()).toBe(a.id);
    expect(await listProfiles()).toHaveLength(1);
  });

  it('bootstrapDb binds the active profile and touches it', async () => {
    const a = await createProfile('Alex', 1000);
    await setActiveProfileId(a.id);
    const p = await bootstrapDb();
    expect(p.id).toBe(a.id);
    expect(db.name).toBe(resolveDbName(a.id));
    expect(getBoundProfileName()).toBe('Alex');
    expect((await registry.profiles.get(a.id))!.lastUsedAt).toBeGreaterThan(1000);
  });

  it('bootstrapDb on a fresh install binds the Default (legacy) database', async () => {
    const p = await bootstrapDb();
    expect(p.id).toBe(PROFILES.defaultId);
    expect(db.name).toBe('lift-log');
    expect(getBoundProfileName()).toBe('Default');
  });

  it('switchProfile sets active, touches and reloads', async () => {
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ reload } as unknown as Location);
    const a = await createProfile('Alex', 1000);
    await switchProfile(a.id);
    expect(reload).toHaveBeenCalledOnce();
    expect(await getActiveProfileId()).toBe(a.id);
    expect((await registry.profiles.get(a.id))!.lastUsedAt).toBeGreaterThan(1000);
  });
});

describe('database isolation', () => {
  it('keeps two profiles fully isolated', async () => {
    const a = await createProfile('Alice');
    const b = await createProfile('Bob');
    const dbA = resolveDbName(a.id);
    const dbB = resolveDbName(b.id);

    bindDb(dbA, 'Alice');
    await ensureSeed();
    const sA = await startSession(1000);
    const seA = await addExercise(sA.id, 'ab-wheel-rollout');
    await addSet(seA.id);
    await finishSession(sA.id, 2000);
    await setUnit('lbs');
    await setDeloadDismissals({ k: 1 });
    await createProgram('Alice plan');
    await createCustomExercise(customInput('Alice press'));

    bindDb(dbB, 'Bob');
    await ensureSeed();
    expect(await listHistory()).toHaveLength(0);
    expect(await db.sets.count()).toBe(0);
    expect(await getUnit()).toBe('kg');
    expect(await getDeloadDismissals()).toEqual({});
    expect(await db.customExercises.count()).toBe(0);
    expect((await loadMergedExercises()).exercises.some((e) => e.name === 'Alice press')).toBe(
      false,
    );
    expect((await listUserPrograms()).length).toBe(0);
    await startSession(5000);
    await createCustomExercise(customInput('Bob press'));
    await createProgram('Bob plan');

    bindDb(dbA, 'Alice');
    expect(await listHistory()).toHaveLength(1);
    expect(await getActiveSession()).toBeUndefined();
    expect(await listSets(seA.id)).toHaveLength(1);
    expect(await getUnit()).toBe('lbs');
    expect(await getDeloadDismissals()).toEqual({ k: 1 });
    expect((await db.customExercises.toArray()).map((c) => c.name)).toEqual(['Alice press']);
    expect((await listUserPrograms()).map((p) => p.name)).toEqual(['Alice plan']);

    bindDb(dbB, 'Bob');
    expect((await db.customExercises.toArray()).map((c) => c.name)).toEqual(['Bob press']);
    expect((await listUserPrograms()).map((p) => p.name)).toEqual(['Bob plan']);
    expect(await getActiveSession()).toBeDefined();
  });

  it('seeds each profile database separately', async () => {
    const a = await createProfile('Alice');
    const b = await createProfile('Bob');
    bindDb(resolveDbName(a.id), 'Alice');
    expect(await db.exercises.count()).toBe(0);
    expect(await ensureSeed()).toBe(true);
    const n = await db.exercises.count();
    expect(n).toBeGreaterThan(0);
    expect(await ensureSeed()).toBe(false);

    bindDb(resolveDbName(b.id), 'Bob');
    expect(await db.exercises.count()).toBe(0);
    expect(await ensureSeed()).toBe(true);
    expect(await db.exercises.count()).toBe(n);
  });

  it('new profile databases start as existing users with no onboarding flag', async () => {
    const a = await createProfile('Alice');
    bindDb(resolveDbName(a.id), 'Alice');
    expect(await getFlag('whatsNewPhase3Seen')).toBe(true);
    expect(await getFlag('whatsNewPhase4Seen')).toBe(true);
    expect(await getFlag('whatsNewPhase5Seen')).toBe(true);
    expect(await getFlag('onboardingDone')).toBe(false);
    expect(await db.settings.get('onboardingDone')).toBeUndefined();
  });
});

describe('deleting profiles', () => {
  it('removes only that profile database', async () => {
    bindDb('lift-log');
    await ensureSeed();
    const a = await createProfile('Alice');
    const b = await createProfile('Bob');
    expect(await Dexie.exists(resolveDbName(a.id))).toBe(true);
    expect(await Dexie.exists(resolveDbName(b.id))).toBe(true);

    await deleteProfile(a.id);

    expect(await Dexie.exists(resolveDbName(a.id))).toBe(false);
    expect(await Dexie.exists(resolveDbName(b.id))).toBe(true);
    expect(await Dexie.exists('lift-log')).toBe(true);
    const names = await Dexie.getDatabaseNames();
    expect(names).toContain(PROFILES.registryDbName);
    expect(names).not.toContain(resolveDbName(a.id));
    expect((await listProfiles()).map((p) => p.name).sort()).toEqual(['Bob', 'Default']);
  });
});

describe('default database untouched', () => {
  it('leaves a pre-phase-5 lift-log database byte-for-byte equal in row counts', async () => {
    bindDb('lift-log');
    await ensureSeed();
    await importData(v4 as unknown as Backup);
    const counts = async () =>
      Object.fromEntries(
        await Promise.all(db.tables.map(async (t) => [t.name, await t.count()] as const)),
      );
    const snapshot = async () => ({
      counts: await counts(),
      settings: await db.settings.toArray(),
      sessions: await db.sessions.toArray(),
    });
    const before = await snapshot();
    expect(before.counts.sessions).toBeGreaterThan(0);

    const boot = await bootstrapDb();
    expect(boot.id).toBe(PROFILES.defaultId);
    const a = await createProfile('Alice');
    const b = await createProfile('Bob');
    await renameProfile(a.id, 'Alice 2');
    await setActiveProfileId(a.id);
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ reload } as unknown as Location);
    await switchProfile(b.id);
    await bootstrapDb();
    expect(db.name).toBe(resolveDbName(b.id));
    await startSession();
    await setActiveProfileId(a.id);
    await deleteProfile(b.id);

    bindDb('lift-log');
    expect(await snapshot()).toEqual(before);
  });
});
