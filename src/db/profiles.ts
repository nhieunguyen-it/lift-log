import Dexie, { type EntityTable } from 'dexie';
import { PROFILES, type ProfileColor } from '@/config/profiles';
import { LiftLogDB, bindDb, db } from './db';
import { validateProfileName } from './profileNames';

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number;
  color?: ProfileColor;
}

interface MetaRow {
  key: string;
  value: unknown;
}

/** The registry: its own small database, separate from every profile's data. */
class RegistryDB extends Dexie {
  profiles!: EntityTable<Profile, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ profiles: 'id, lastUsedAt', meta: 'key' });
  }
}

export const registry = new RegistryDB(PROFILES.registryDbName);

export class ProfileError extends Error {}

/** Default maps to the pre-phase-5 database; every other profile gets `lift-log-p-<id>`. */
export function resolveDbName(profileId: string): string {
  return profileId === PROFILES.defaultId
    ? PROFILES.legacyDbName
    : `${PROFILES.dbNamePrefix}${profileId}`;
}

/** Creates the registry content (a Default entry) the first time it is read. */
async function ensureRegistry(now = Date.now()): Promise<void> {
  await registry.transaction('rw', registry.profiles, registry.meta, async () => {
    if ((await registry.meta.get('initialized'))?.value === true) return;
    if ((await registry.profiles.count()) === 0) {
      await registry.profiles.add({
        id: PROFILES.defaultId,
        name: PROFILES.defaultName,
        createdAt: now,
        lastUsedAt: now,
        color: PROFILES.colors[0],
      });
    }
    await registry.meta.put({ key: 'activeProfileId', value: PROFILES.defaultId });
    await registry.meta.put({ key: 'initialized', value: true });
  });
}

const byRecent = (a: Profile, b: Profile) =>
  b.lastUsedAt - a.lastUsedAt || a.name.localeCompare(b.name);

/** Read-only (safe inside live queries); the registry exists after bootstrap. */
export async function readProfiles(): Promise<Profile[]> {
  return (await registry.profiles.toArray()).sort(byRecent);
}

/** Most recently used first. Creates the registry on first read. */
export async function listProfiles(): Promise<Profile[]> {
  await ensureRegistry();
  return readProfiles();
}

export async function getActiveProfileId(): Promise<string> {
  await ensureRegistry();
  const id = (await registry.meta.get('activeProfileId'))?.value;
  if (typeof id === 'string' && (await registry.profiles.get(id))) return id;
  // Dangling pointer (should not happen): fall back to any profile.
  const first = await registry.profiles.toCollection().first();
  if (!first) throw new Error('No profiles in the registry.');
  return first.id;
}

export async function setActiveProfileId(id: string): Promise<void> {
  await ensureRegistry();
  if (!(await registry.profiles.get(id))) throw new ProfileError('Unknown profile.');
  await registry.meta.put({ key: 'activeProfileId', value: id });
}

/** Writes the "already seen" flags a brand-new profile starts with (it is a new user). */
async function initProfileDb(id: string): Promise<void> {
  const fresh = new LiftLogDB(resolveDbName(id));
  try {
    await fresh.settings.bulkPut([
      { key: 'whatsNewPhase3Seen', value: true },
      { key: 'whatsNewPhase4Seen', value: true },
      { key: 'whatsNewPhase5Seen', value: true },
    ]);
  } finally {
    fresh.close();
  }
}

export async function createProfile(name: string, now = Date.now()): Promise<Profile> {
  const existing = await listProfiles();
  const check = validateProfileName(name, existing);
  if (!check.ok) throw new ProfileError(check.error);
  const used = new Set(existing.map((p) => p.color));
  const profile: Profile = {
    id: crypto.randomUUID(),
    name: check.name,
    createdAt: now,
    lastUsedAt: now,
    color:
      PROFILES.colors.find((c) => !used.has(c)) ??
      PROFILES.colors[existing.length % PROFILES.colors.length],
  };
  await initProfileDb(profile.id);
  try {
    await registry.profiles.add(profile);
  } catch (err) {
    await Dexie.delete(resolveDbName(profile.id));
    throw err;
  }
  return profile;
}

export async function renameProfile(id: string, name: string): Promise<Profile> {
  const existing = await listProfiles();
  const target = existing.find((p) => p.id === id);
  if (!target) throw new ProfileError('Unknown profile.');
  const check = validateProfileName(name, existing, id);
  if (!check.ok) throw new ProfileError(check.error);
  await registry.profiles.update(id, { name: check.name });
  return { ...target, name: check.name };
}

/**
 * Deletes a profile's database and registry row. Refuses the active profile (switch first) and
 * the only remaining profile. Never touches any other database.
 */
export async function deleteProfile(id: string): Promise<void> {
  const existing = await listProfiles();
  if (!existing.some((p) => p.id === id)) throw new ProfileError('Unknown profile.');
  if (id === (await getActiveProfileId()) || resolveDbName(id) === db.name) {
    throw new ProfileError('Switch to another profile before deleting this one.');
  }
  if (existing.length <= 1) throw new ProfileError('You cannot delete the only profile.');
  // Row first: a crash in between leaves an orphan database, never a row pointing at nothing.
  await registry.profiles.delete(id);
  await Dexie.delete(resolveDbName(id));
}

export async function touchProfile(id: string, now = Date.now()): Promise<void> {
  await registry.profiles.update(id, { lastUsedAt: now });
}

/** Makes `id` the active profile and reloads so every query binds to its database. */
export async function switchProfile(id: string): Promise<void> {
  await setActiveProfileId(id);
  await touchProfile(id);
  window.location.reload();
}

/**
 * Startup: resolves the active profile from the registry and binds `db` to its database.
 * Call once, before rendering.
 */
export async function bootstrapDb(): Promise<Profile> {
  const id = await getActiveProfileId();
  const profile = (await registry.profiles.get(id))!;
  bindDb(resolveDbName(profile.id), profile.name);
  await touchProfile(profile.id);
  return profile;
}
