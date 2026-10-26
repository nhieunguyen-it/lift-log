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

describe('formatVolume rounding', () => {
  it('rounds once when converting to lbs', () => {
    // 1000.3 kg = 2205.4 lbs; double rounding via 0.5 kg would give 2,206.
    expect(formatVolume(1000.3, 'lbs')).toBe('2,205 lbs');
  });
});

describe('display/parse round trips', () => {
  it('every typed lbs value 0..600 is stable', () => {
    for (let lbs = 0; lbs <= 600; lbs++) {
      const kg = parseWeightInput(String(lbs), 'lbs')!;
      expect(weightInputText(kg, 'lbs')).toBe(String(lbs));
    }
  });
  it('every typed kg value 0..300 in 0.5 steps is stable', () => {
    for (let i = 0; i <= 600; i++) {
      const text = String(i / 2);
      const kg = parseWeightInput(text, 'kg')!;
      expect(weightInputText(kg, 'kg')).toBe(text);
    }
  });
  it('displays target-chip style values consistently', () => {
    expect(weightInputText(82.5, 'kg')).toBe('82.5');
    expect(weightInputText(82.5, 'lbs')).toBe('182');
    const kg = parseWeightInput(weightInputText(82.5, 'lbs'), 'lbs')!;
    expect(weightInputText(kg, 'lbs')).toBe('182');
    expect(weightInputText(kg, 'lbs')).toBe(weightInputText(82.5, 'lbs'));
  });
});
