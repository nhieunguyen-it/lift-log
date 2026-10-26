/** One exercise list for engines and UI: seed + user-created (custom) exercises. */
import type { RepRange } from '@/config/training';
import type { Exercise } from './index';

export const CUSTOM_ID_PREFIX = 'custom-';

export interface MergedExercise extends Exercise {
  isCustom?: boolean;
  /** Custom exercises can set their own rep range. */
  repRange?: RepRange;
  /** Soft-deleted custom exercise kept as a tombstone so history stays readable. */
  deletedAt?: number;
}

export const isCustomId = (id: string): boolean => id.startsWith(CUSTOM_ID_PREFIX);
export const DELETED_EXERCISE_NAME = 'Deleted exercise';
