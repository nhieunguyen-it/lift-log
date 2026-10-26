import { describe, expect, it } from 'vitest';
import { formatWeight, kgToLbs, lbsToKg, roundKg, roundLbs } from './units';

describe('units', () => {
  it('converts kg to lbs and back', () => {
    expect(kgToLbs(100)).toBeCloseTo(220.462, 2);
    expect(lbsToKg(kgToLbs(82.5))).toBeCloseTo(82.5, 6);
  });

  it('rounds to 0.5 kg and 1 lb', () => {
    expect(roundKg(60.2)).toBe(60);
    expect(roundKg(60.3)).toBe(60.5);
    expect(roundLbs(135.4)).toBe(135);
    expect(roundLbs(135.5)).toBe(136);
  });

  it('formats for display', () => {
    expect(formatWeight(61.1, 'kg')).toBe('61 kg');
    expect(formatWeight(60, 'lbs')).toBe('132 lbs');
  });
});
