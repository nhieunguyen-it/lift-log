import { MUSCLE_IDS } from '@/data';
import type { MuscleId } from '@/data';
import { BODY_REGIONS } from './bodyMapPaths';
import type { BodyView } from './bodyMapPaths';

/** Region lookup (re-exports the single mapping in bodyMapPaths.ts). */
export const regionsFor = (view: BodyView) => BODY_REGIONS.filter((r) => r.view === view);

/** Muscles that have at least one tappable region. */
export const MAPPED_MUSCLES: ReadonlySet<MuscleId> = new Set(BODY_REGIONS.map((r) => r.muscleId));

export const allMusclesMapped = (): boolean => MUSCLE_IDS.every((id) => MAPPED_MUSCLES.has(id));
