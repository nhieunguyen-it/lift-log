import type { MuscleId } from '@/data';
import { DEFAULT_TARGETS, type VolumeTarget } from '@/config/training';

export type TargetOverrides = Partial<Record<MuscleId, VolumeTarget>>;

/** Defaults merged with the user's per-muscle overrides. */
export function resolveTargets(overrides: TargetOverrides): Record<MuscleId, VolumeTarget> {
  return { ...DEFAULT_TARGETS, ...overrides };
}
