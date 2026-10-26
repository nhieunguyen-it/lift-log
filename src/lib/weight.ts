import { kgToLbs, lbsToKg, roundKg, roundLbs, type WeightUnit } from './units';

/** kg (storage) -> number shown in the user's unit, rounded for display. */
export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? roundKg(kg) : roundLbs(kgToLbs(kg));
}

/** Text for an <input>; empty string when unset. */
export function weightInputText(kg: number | undefined, unit: WeightUnit): string {
  return kg === undefined ? '' : String(kgToDisplay(kg, unit));
}

/**
 * Parse text typed in the user's unit to kg for storage. Returns undefined for
 * empty/invalid/negative input. The typed value is rounded (0.5 kg / 1 lb) first.
 */
export function parseWeightInput(text: string, unit: WeightUnit): number | undefined {
  const n = Number(text.trim().replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(n) || n < 0) return undefined;
  return unit === 'kg' ? roundKg(n) : lbsToKg(roundLbs(n));
}

export function parseIntInput(text: string): number | undefined {
  const n = Number(text.trim());
  if (text.trim() === '' || !Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

export function formatVolume(kg: number, unit: WeightUnit): string {
  const v = kgToDisplay(kg, unit);
  return `${Math.round(v).toLocaleString('en-US')} ${unit}`;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
