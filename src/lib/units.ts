export const LBS_PER_KG = 2.20462262185;

export function kgToLbs(kg: number): number {
  return kg * LBS_PER_KG;
}

export function lbsToKg(lbs: number): number {
  return lbs / LBS_PER_KG;
}

/** Round a kg value to the nearest 0.5 kg for display. */
export function roundKg(kg: number): number {
  return Math.round(kg * 2) / 2;
}

/** Round a lbs value to the nearest 1 lb for display. */
export function roundLbs(lbs: number): number {
  return Math.round(lbs);
}

export type WeightUnit = 'kg' | 'lbs';

/** Format a weight stored in kg for display in the given unit. */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return unit === 'kg' ? `${roundKg(kg)} kg` : `${roundLbs(kgToLbs(kg))} lbs`;
}
