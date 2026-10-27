import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { TRAINING } from '@/config/training';
import { makeData, makeSession } from '@/analyzer/fixtures';
import { db } from './db';
import { ensureSeed } from './seed';
import {
  dismissDeload,
  getDeloadSignal,
  getE1rmHistory,
  getExerciseDeloadHint,
  getLongTrend,
} from './progressRepo';

const DAY = 86_400_000;
const T0 = new Date(2026, 0, 5, 18).getTime();

async function load(only?: string) {
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
  await db.sessions.bulkAdd(d.sessions);
  await db.sessionExercises.bulkAdd(d.sessionExercises);
  await db.sets.bulkAdd(d.sets);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureSeed();
});

describe('progress repo', () => {
  it('returns a deload signal, honors dismissal and expires it', async () => {
    await load();
    const now = T0 + 12 * DAY;
    const signal = await getDeloadSignal(now);
    expect(signal?.overall).toBe(true);
    await dismissDeload(signal!.key, now);
    expect(await getDeloadSignal(now + DAY)).toBeNull();
    expect(await getDeloadSignal(now + TRAINING.deload.dismissMs + 1)).not.toBeNull();
    expect(await db.sets.count()).toBe(24); // never mutates workout data
  });

  it('returns long trend and e1RM history', async () => {
    await load();
    const { trend } = await getLongTrend(T0 + 12 * DAY);
    expect(trend.chest).toHaveLength(TRAINING.longTrendWeeks + 1);
    const h = await getE1rmHistory('barbell-bench-press');
    expect(h.map((p) => Math.round(p.e1rmKg * 100) / 100)).toEqual([120, 120, 116.67, 110]);
  });

  it('per-exercise hint only without an overall signal; dismissible', async () => {
    const now = T0 + 12 * DAY;
    await load('barbell-bench-press');
    expect(await getDeloadSignal(now)).toBeNull();
    const hint = await getExerciseDeloadHint('barbell-bench-press', now);
    expect(hint?.detail).toMatch(/e1RM down \d+% over 4 sessions/);
    expect(await getExerciseDeloadHint('barbell-back-squat', now)).toBeNull();
    await dismissDeload(hint!.key, now);
    expect(await getExerciseDeloadHint('barbell-bench-press', now + DAY)).toBeNull();
    expect(await db.sets.count()).toBe(12);
  });

  it('no per-exercise hint when a full deload is suggested', async () => {
    await load();
    expect(await getExerciseDeloadHint('barbell-bench-press', T0 + 12 * DAY)).toBeNull();
  });
});
