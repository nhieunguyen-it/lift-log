import { describe, expect, it } from 'vitest';
import { completedReps, pittEvents, pittPhaseAt, type PittConfig } from './pittTimer';

const c: PittConfig = { countdownSec: 3, repSec: 2, pauseSec: 4, reps: 20 };

describe('pittPhaseAt', () => {
  it('starts with countdown', () =>
    expect(pittPhaseAt(0, c)).toEqual({ phase: 'countdown', msLeft: 3000 }));
  it('countdown ends at 3000', () =>
    expect(pittPhaseAt(2999, c)).toEqual({ phase: 'countdown', msLeft: 1 }));
  it('rep 1 starts at 3000', () =>
    expect(pittPhaseAt(3000, c)).toEqual({ phase: 'rep', rep: 1, msLeft: 2000 }));
  it('pause after rep 1', () =>
    expect(pittPhaseAt(5000, c)).toEqual({ phase: 'pause', rep: 1, msLeft: 4000 }));
  it('rep 2 starts at 9000', () =>
    expect(pittPhaseAt(9000, c)).toEqual({ phase: 'rep', rep: 2, msLeft: 2000 }));
  it('last rep has no trailing pause', () => {
    // last rep starts at 3000 + 19*6000 = 117000, ends 119000
    expect(pittPhaseAt(118999, c)).toEqual({ phase: 'rep', rep: 20, msLeft: 1 });
    expect(pittPhaseAt(119000, c)).toEqual({ phase: 'done', rep: 20 });
  });
  it('pause msLeft counts down', () =>
    expect(pittPhaseAt(4000, { countdownSec: 3, repSec: 1, pauseSec: 3, reps: 5 })).toEqual({
      phase: 'pause',
      rep: 1,
      msLeft: 3000,
    }));
  it('negative elapsed treated as 0', () =>
    expect(pittPhaseAt(-500, c)).toEqual({ phase: 'countdown', msLeft: 3000 }));
});

describe('completedReps', () => {
  it('0 during countdown and first rep', () => {
    expect(completedReps(0, c)).toBe(0);
    expect(completedReps(4000, c)).toBe(0);
  });
  it('counts reps whose rep phase has elapsed', () => {
    expect(completedReps(5000, c)).toBe(1);
    expect(completedReps(8000, c)).toBe(1);
  });
  it('caps at reps', () => expect(completedReps(500000, c)).toBe(20));
  it('negative elapsed is 0', () => expect(completedReps(-1, c)).toBe(0));
});

describe('pittEvents', () => {
  it('lists tones in order', () =>
    expect(pittEvents({ ...c, reps: 2 })).toEqual([
      { atMs: 0, kind: 'tick' },
      { atMs: 1000, kind: 'tick' },
      { atMs: 2000, kind: 'tick' },
      { atMs: 3000, kind: 'go' },
      { atMs: 5000, kind: 'hold' },
      { atMs: 9000, kind: 'go' },
      { atMs: 11000, kind: 'done' },
    ]));
});
