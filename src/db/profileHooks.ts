import { useLiveQuery } from 'dexie-react-hooks';
import { getBoundProfileName } from './db';
import { readProfiles, type Profile } from './profiles';

/** Registry rows, most recently used first. `undefined` while loading. */
export const useProfiles = (): Profile[] | undefined => useLiveQuery(() => readProfiles(), []);

/** Name of the profile this page load is bound to (fixed until the next reload). */
export const useActiveProfileName = (): string => getBoundProfileName() ?? '';
