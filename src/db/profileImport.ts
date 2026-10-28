import Dexie from 'dexie';
import { bindDb, db } from './db';
import { importData, type Backup } from './backup';
import { ensureSeed } from './seed';
import {
  createProfile,
  getActiveProfileId,
  listProfiles,
  registry,
  resolveDbName,
  setActiveProfileId,
} from './profiles';
import { suggestImportName } from './profileNames';

/** Default name offered when importing `backup` into a new profile. */
export async function defaultImportName(backup: Backup): Promise<string> {
  return suggestImportName(backup.profile?.name, await listProfiles());
}

/**
 * Creates a profile, imports the backup into its database and makes it active. The caller
 * reloads afterwards. On failure the new profile is removed and the current one stays bound.
 */
export async function importIntoNewProfile(backup: Backup, name: string): Promise<string> {
  const previous = await getActiveProfileId();
  const previousName = db.name;
  const profile = await createProfile(name);
  try {
    bindDb(resolveDbName(profile.id), profile.name);
    await ensureSeed();
    await importData(backup);
    await setActiveProfileId(profile.id);
    await registry.profiles.update(profile.id, { lastUsedAt: Date.now() });
    return profile.id;
  } catch (err) {
    bindDb(previousName, (await registry.profiles.get(previous))?.name);
    await setActiveProfileId(previous);
    await Dexie.delete(resolveDbName(profile.id));
    await registry.profiles.delete(profile.id);
    throw err;
  }
}
