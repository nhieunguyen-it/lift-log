import { describe, expect, it } from 'vitest';
import { activeMs, formatClock, isPaused } from './workoutTimer';

const MIN = 60_000;
describe('activeMs', () => {
  it('never paused', () => expect(activeMs({ startedAt: 0 }, 30 * MIN)).toBe(30 * MIN));
  it('subtracts closed pauses', () =>
    expect(activeMs({ startedAt: 0, pausedMs: 5 * MIN }, 30 * MIN)).toBe(25 * MIN));
  it('subtracts an open pause up to end', () =>
    expect(activeMs({ startedAt: 0, pausedMs: 5 * MIN, pausedAt: 20 * MIN }, 30 * MIN)).toBe(
      15 * MIN,
    ));
  it('open pause starting after end contributes 0', () =>
    expect(activeMs({ startedAt: 0, pausedAt: 40 * MIN }, 30 * MIN)).toBe(30 * MIN));
  it('never negative', () =>
    expect(activeMs({ startedAt: 0, pausedMs: 60 * MIN }, 30 * MIN)).toBe(0));
});
describe('formatClock', () => {
  it.each([
    [0, '00:00'],
    [59 * MIN + 59_000, '59:59'],
    [60 * MIN, '1:00:00'],
    [10 * 60 * MIN + 5 * MIN + 3_000, '10:05:03'],
    [1_999, '00:01'], // floors to whole seconds
  ])('%i ms -> %s', (ms, out) => expect(formatClock(ms)).toBe(out));
});
it('isPaused', () => {
  expect(isPaused({})).toBe(false);
  expect(isPaused({ pausedAt: 1 })).toBe(true);
});
