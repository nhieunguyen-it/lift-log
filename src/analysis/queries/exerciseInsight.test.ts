import { describe, expect, it } from 'vitest';
import { makeData, makeSession } from '../engine/fixtures';
import { nextTarget } from '../recommend';
import { alternatives, exerciseInsight } from './exerciseInsight';
import { makeInput } from './testInput';

const DAY = 86_400_000;
const NOW = new Date(2026, 0, 7, 12).getTime();

const bench = (weightKg: number) => ({
  exerciseId: 'barbell-bench-press',
  sets: Array(3).fill({ weightKg, reps: 8 }),
});

const data = () =>
  makeData(makeSession('s1', NOW - 3 * DAY, [bench(60)]), makeSession('s2', NOW, [bench(70)]));

describe('exerciseInsight', () => {
  it('excludes the current session from history', () => {
    const input = makeInput(data());
    const r = exerciseInsight(input, 'barbell-bench-press', 's2');
    expect(r?.stats.history.map((h) => h.sessionId)).toEqual(['s1']);
    expect(r?.stats.lastSession?.sessionId).toBe('s1');
    expect(exerciseInsight(input, 'barbell-bench-press')?.stats.history).toHaveLength(2);
  });

  it('is null for an unknown exercise', () => {
    expect(exerciseInsight(makeInput(data()), 'nope')).toBeNull();
  });

  it('passes the unit to nextTarget', () => {
    const d = data();
    const input = makeInput(d, { settings: { unit: 'lbs' } });
    const r = exerciseInsight(input, 'barbell-bench-press', 's2');
    const exercise = d.exercises.find((e) => e.id === 'barbell-bench-press')!;
    const expected = nextTarget({
      exercise,
      primaryMuscleIds: ['chest'],
      history: r!.stats.history,
      unit: 'lbs',
      exercises: d.exercises,
    });
    expect(r?.target).toEqual(expected);
  });
});

describe('alternatives', () => {
  it('respects equipment', () => {
    const d = data();
    const full = alternatives(makeInput(d), 'barbell-bench-press');
    expect(full.length).toBeGreaterThan(0);
    const limited = alternatives(
      makeInput(d, { settings: { equipment: ['bodyweight'] } }),
      'barbell-bench-press',
    );
    for (const a of limited) {
      expect(d.exercises.find((e) => e.id === a.exerciseId)?.equipment).toBe('bodyweight');
    }
  });
});
