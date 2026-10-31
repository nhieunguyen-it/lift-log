import { describe, expect, it } from 'vitest';
import type { CardioEntry, CardioIntensity } from '@/db/types';
import {
  cardioSetCredit,
  countedMinutes,
  estimateDistanceKm,
  formatDistance,
  formatEstimate,
  isCardio,
} from './cardio';

const entry = (min: number, intensity: CardioIntensity = 'relaxed', done = true): CardioEntry => ({
  id: `e${min}${intensity}`,
  sessionExerciseId: 'se',
  order: 0,
  durationSec: min * 60,
  intensity,
  completedAt: done ? 1 : undefined,
});

describe('cardio engine', () => {
  it('estimates distance for every profile', () => {
    expect(estimateDistanceKm('running', 'relaxed', 1800)).toBeCloseTo(4.285, 2);
    expect(estimateDistanceKm('cycling', 'relaxed', 1800)).toBeCloseTo(8, 5);
    expect(estimateDistanceKm('swim-freestyle', 'relaxed', 1800)).toBeCloseTo(1, 5);
    expect(estimateDistanceKm('swim-breaststroke', 'hard', 3600)).toBeCloseTo(2.4, 5);
    expect(estimateDistanceKm(undefined, 'relaxed', 1800)).toBeUndefined();
  });
  it('formats pace per profile and rounds to the table', () => {
    expect(formatEstimate('running', 'relaxed', 1800)).toBe('≈ 4.3 km · 7:00 /km');
    expect(formatEstimate('running', 'hard', 1800)).toBe('≈ 6.0 km · 5:00 /km');
    expect(formatEstimate('cycling', 'relaxed', 1800)).toBe('≈ 8.0 km · 16 km/h');
    expect(formatEstimate('swim-freestyle', 'relaxed', 1800)).toBe('≈ 1,000 m · 3:00 /100 m');
    expect(formatEstimate('swim-breaststroke', 'relaxed', 1800)).toBe('≈ 855 m · 3:30 /100 m');
    expect(formatEstimate('running', 'relaxed', 0)).toBeUndefined();
    expect(formatEstimate(undefined, 'relaxed', 1800)).toBeUndefined();
  });
  it('formats distance per profile', () => {
    expect(formatDistance('running', 4.2857)).toBe('4.3 km');
    expect(formatDistance('cycling', 8)).toBe('8.0 km');
    expect(formatDistance('swim-breaststroke', 0.85715)).toBe('855 m');
    expect(formatDistance('swim-freestyle', 1)).toBe('1,000 m');
  });
  it('credits 10 relaxed minutes as one set with intensity multipliers', () => {
    expect(cardioSetCredit([entry(10)])).toBe(1);
    expect(cardioSetCredit([entry(10, 'moderate')])).toBe(1.5);
    expect(cardioSetCredit([entry(10, 'hard')])).toBe(2);
    expect(cardioSetCredit([entry(10), entry(5, 'hard')])).toBe(2);
  });
  it('caps credit at 3 per session exercise', () => {
    expect(cardioSetCredit([entry(120)])).toBe(3);
    expect(cardioSetCredit([entry(20), entry(20)])).toBe(3);
  });
  it('ignores uncompleted and 0-minute entries', () => {
    expect(cardioSetCredit([entry(30, 'relaxed', false), entry(0)])).toBe(0);
    expect(countedMinutes([entry(30), entry(15, 'hard', false)])).toBe(30);
  });
  it('treats missing tracking as strength', () => {
    expect(isCardio({})).toBe(false);
    expect(isCardio(undefined)).toBe(false);
    expect(isCardio({ tracking: 'cardio' })).toBe(true);
  });
});
