import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatVolume,
  kgToDisplay,
  parseWeightInput,
  weightInputText,
} from './weight';

describe('weight helpers', () => {
  it('converts for display with rounding', () => {
    expect(kgToDisplay(100, 'kg')).toBe(100);
    expect(kgToDisplay(100.3, 'kg')).toBe(100.5);
    expect(kgToDisplay(100, 'lbs')).toBe(220);
    expect(weightInputText(undefined, 'kg')).toBe('');
  });
  it('parses input to kg and round-trips lbs', () => {
    expect(parseWeightInput('', 'kg')).toBeUndefined();
    expect(parseWeightInput('abc', 'kg')).toBeUndefined();
    expect(parseWeightInput('-5', 'kg')).toBeUndefined();
    expect(parseWeightInput('82.7', 'kg')).toBe(82.5);
    expect(parseWeightInput('82,5', 'kg')).toBe(82.5);
    const kg = parseWeightInput('225', 'lbs')!;
    expect(kgToDisplay(kg, 'lbs')).toBe(225);
  });
  it('formats volume and duration', () => {
    expect(formatVolume(1000, 'kg')).toBe('1,000 kg');
    expect(formatVolume(1000, 'lbs')).toBe('2,205 lbs');
    expect(formatDuration(45 * 60_000)).toBe('45m');
    expect(formatDuration(75 * 60_000)).toBe('1h 15m');
  });
});
