/** Training system metadata. Pure data: no React or Dexie. */
import type { RepRange } from '@/config/training';
import type { StoredSystem, TrainingSystem } from './types';

export const SYSTEM_INFO: Record<TrainingSystem, { label: string; short: string; hint: string }> = {
  progression: {
    label: 'Progression',
    short: 'Progression',
    hint: 'Same weight every set. Add weight once every set hits the top reps.',
  },
  pyramid_up: {
    label: 'Pyramid ▲ (light → heavy)',
    short: 'Pyramid ▲',
    hint: 'Start lighter, add weight each set; reps drop.',
  },
  pyramid_down: {
    label: 'Pyramid ▼ (heavy → light)',
    short: 'Pyramid ▼',
    hint: 'Start heavy, drop weight each set; reps rise.',
  },
  pitt_force: {
    label: 'PITT-Force',
    short: 'PITT-Force',
    hint: 'Single paused reps with 3–4 s rest; the timer paces you.',
  },
};

export const PITT_DEFAULT_RANGE: RepRange = { min: 20, max: 20 };

export const systemOf = (x: { system?: StoredSystem }): TrainingSystem => x.system ?? 'progression';
