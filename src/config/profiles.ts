/** Local profiles: limits, storage names and colour tokens. Read from here, never hard-code. */
export const PROFILES = {
  /** Most profiles that can exist on one device. */
  max: 8,
  nameMinLength: 1,
  nameMaxLength: 24,
  /** Profiles listed in the switcher sheet before "Manage profiles" is needed. */
  switcherListSize: 5,
  /** The pre-phase-5 `lift-log` database is the Default profile, unchanged. */
  defaultId: 'default',
  defaultName: 'Default',
  legacyDbName: 'lift-log',
  dbNamePrefix: 'lift-log-p-',
  registryDbName: 'lift-log-profiles',
  /** Avatar colour tokens, handed out in rotation to new profiles. */
  colors: ['blue', 'green', 'amber', 'rose', 'violet', 'teal'],
} as const;

export type ProfileColor = (typeof PROFILES.colors)[number];
