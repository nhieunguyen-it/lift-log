/** Pure cardio helpers: pace-table estimates and set-equivalent credit. No React or Dexie. */
import { TRAINING } from '@/config/training';
import type { CardioProfile } from '@/data/schema';
import type { CardioEntry, CardioIntensity } from '@/db/types';

export function isCardio(e: { tracking?: string } | undefined): boolean {
  return e?.tracking === 'cardio';
}

export function speedKmh(profile: CardioProfile, intensity: CardioIntensity): number {
  return TRAINING.cardio.profiles[profile][intensity];
}

const isSwim = (profile: CardioProfile) => profile.startsWith('swim-');

export function estimateDistanceKm(
  profile: CardioProfile | undefined,
  intensity: CardioIntensity,
  durationSec: number,
): number | undefined {
  if (!profile || !TRAINING.cardio.profiles[profile]) return undefined;
  return (speedKmh(profile, intensity) * durationSec) / 3600;
}

/** "4.3 km" for running/cycling, "1,000 m" (nearest 5 m) for swims. */
export function formatDistance(profile: CardioProfile, km: number): string {
  if (isSwim(profile)) {
    const metres = Math.round((km * 1000) / 5) * 5;
    return `${metres.toLocaleString('en-US')} m`;
  }
  return `${km.toFixed(1)} km`;
}

function formatPace(minutes: number): string {
  const total = Math.round(minutes * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function formatEstimate(
  profile: CardioProfile | undefined,
  intensity: CardioIntensity,
  durationSec: number,
): string | undefined {
  if (durationSec <= 0) return undefined;
  const km = estimateDistanceKm(profile, intensity, durationSec);
  if (!profile || km === undefined) return undefined;
  const speed = speedKmh(profile, intensity);
  let pace: string;
  if (profile === 'cycling') pace = `${Math.round(speed)} km/h`;
  else if (isSwim(profile)) pace = `${formatPace(6 / speed)} /100 m`;
  else pace = `${formatPace(60 / speed)} /km`;
  return `≈ ${formatDistance(profile, km)} · ${pace}`;
}

export function isCountedEntry(e: CardioEntry): boolean {
  return e.completedAt !== undefined && e.durationSec > 0;
}

/** Set-equivalents earned by a session exercise's entries, capped per session. */
export function cardioSetCredit(entries: CardioEntry[], config = TRAINING.cardio): number {
  let credit = 0;
  for (const e of entries) {
    if (!isCountedEntry(e)) continue;
    credit += (e.durationSec / 60 / config.minutesPerSet) * config.intensityMultiplier[e.intensity];
  }
  return Math.min(credit, config.maxSetsPerSession);
}

export function countedMinutes(entries: CardioEntry[]): number {
  return entries.filter(isCountedEntry).reduce((sum, e) => sum + e.durationSec / 60, 0);
}
