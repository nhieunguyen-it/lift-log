import { describe, expect, it } from 'vitest';
import { TRAINING } from '@/config/training';
import { makeData, makeSession } from '../engine/fixtures';
import { makeInput } from './testInput';
import { deloadSignal, e1rmHistory, exerciseDeloadHint, longTrend } from './progress';

const DAY = 86_400_000;
const T0 = new Date(2026, 0, 5, 18).getTime();

function load(only?: string) {
  const rows = [100, 100, 100, 100];
  const reps = [6, 6, 5, 3];
  const sq = [10, 8, 7, 6];
  const sqW = [60, 65, 67.5, 70];
  const sqR = [3, 2, 1, 1];
  const parts = rows.map((w, i) =>
    makeSession(`s${i}`, T0 + i * 3 * DAY, [
      { exerciseId: 'barbell-bench-press', sets: Array(3).fill({ weightKg: w, reps: reps[i] }) },
      {
        exerciseId: 'barbell-back-squat',
        sets: Array(3).fill({ weightKg: sqW[i], reps: sq[i], rir: sqR[i] }),
      },
    ]),
  );
  const d = makeData(...parts);
  if (only) {
    const keep = new Set(
      d.sessionExercises.filter((se) => se.exerciseId === only).map((se) => se.id),
    );
    d.sessionExercises = d.sessionExercises.filter((se) => keep.has(se.id));
    d.sets = d.sets.filter((st) => keep.has(st.sessionExerciseId));
  }
  return d;
}

describe('progress queries', () => {
  it('deload signal honours dismissal and expiry', () => {
    const now = T0 + 12 * DAY;
    const data = load();
    const signal = deloadSignal(makeInput(data, { now }));
    expect(signal?.overall).toBe(true);
    const dismissals = { [signal!.key]: now };
    expect(
      deloadSignal(makeInput(data, { now: now + DAY, deloadDismissals: dismissals })),
    ).toBeNull();
    expect(
      deloadSignal(
        makeInput(data, { now: now + TRAINING.deload.dismissMs + 1, deloadDismissals: dismissals }),
      ),
    ).not.toBeNull();
  });

  it('long trend and e1RM history', () => {
    const input = makeInput(load(), { now: T0 + 12 * DAY });
    const { trend } = longTrend(input, T0 + 12 * DAY);
    expect(trend.chest).toHaveLength(TRAINING.longTrendWeeks + 1);
    const h = e1rmHistory(input, 'barbell-bench-press');
    expect(h.map((p) => Math.round(p.e1rmKg * 100) / 100)).toEqual([120, 120, 116.67, 110]);
  });

  it('per-exercise hint only without an overall signal; dismissible', () => {
    const now = T0 + 12 * DAY;
    const data = load('barbell-bench-press');
    const input = makeInput(data, { now });
    expect(deloadSignal(input)).toBeNull();
    const hint = exerciseDeloadHint(input, 'barbell-bench-press');
    expect(hint?.detail).toMatch(/e1RM down \d+% over 4 sessions/);
    expect(exerciseDeloadHint(input, 'barbell-back-squat')).toBeNull();
    const later = makeInput(data, {
      now: now + DAY,
      deloadDismissals: { 'exercise:barbell-bench-press': now },
    });
    expect(exerciseDeloadHint(later, 'barbell-bench-press')).toBeNull();
  });

  it('no per-exercise hint during a full deload', () => {
    const input = makeInput(load(), { now: T0 + 12 * DAY });
    expect(exerciseDeloadHint(input, 'barbell-bench-press')).toBeNull();
  });
});
