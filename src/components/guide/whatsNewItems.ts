/** Phase 3 feature list for the What's new dialog. Anchors must exist in the guide content. */
export const WHATS_NEW_ITEMS: { title: string; blurb: string; anchor: string }[] = [
  { title: 'Programs', blurb: 'Plan your weeks and follow a routine.', anchor: 'programs' },
  {
    title: 'Variant chains and deload suggestions',
    blurb: 'Swap in variants and get a nudge when fatigue builds.',
    anchor: 'progression-deload',
  },
  {
    title: 'Progress charts',
    blurb: 'See strength and volume trends over time.',
    anchor: 'analyze-trend',
  },
  { title: 'Custom exercises', blurb: 'Add your own exercises.', anchor: 'custom-exercises' },
  { title: 'Encrypted backups', blurb: 'Protect exports with a passphrase.', anchor: 'backups' },
  {
    title: 'This guide',
    blurb: 'Search how everything works, offline.',
    anchor: 'getting-started-guide',
  },
];
