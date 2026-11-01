import { describe, expect, it } from 'vitest';
import type { Program } from '@/program/types';
import { makeData, makeSession } from '../engine/fixtures';
import type { TrainingData } from '../engine';
import { analysis, analyzeView } from './analyzeView';
import { makeInput } from './testInput';

const DAY = 86_400_000;
// Wednesday 7 Jan 2026 noon; week starts Monday by default.
const NOW = new Date(2026, 0, 7, 12).getTime();

const bench = (n: number) => ({
  exerciseId: 'barbell-bench-press',
  sets: Array(n).fill({ weightKg: 60, reps: 8 }),
});

const data = () =>
  makeData(
    makeSession('cur', NOW - DAY, [bench(4)]),
    makeSession('prev', NOW - 7 * DAY, [bench(3)]),
  );

const program3: Program = {
  id: 'p',
  name: 'P',
  builtIn: false,
  days: [1, 2, 3].map((n) => ({ id: `d${n}`, name: `Day ${n}`, exercises: [] })),
  createdAt: 0,
  updatedAt: 0,
};

describe('analyzeView', () => {
  it('summarises this week against last', () => {
    const v = analyzeView(makeInput(data()), NOW);
    expect(v.summary.sessions).toBeUndefined();
    expect(v.summary.totalSets).toBe(4);
    expect(v.summary.previousTotalSets).toBe(3);
    expect(v.summary.delta).toBe(1);
    expect(v.empty).toBe(false);
  });

  it('counts sessions against an active program', () => {
    const v = analyzeView(makeInput(data(), { program: { active: program3, blocks: {} } }), NOW);
    expect(v.summary.sessions).toEqual({ done: 1, planned: 3 });
  });

  it('empty profile', () => {
    expect(analyzeView(makeInput(makeData()), NOW).empty).toBe(true);
  });

  it('credits cardio-only weeks', () => {
    const base = makeData();
    const d: TrainingData = {
      ...base,
      sessions: [{ id: 'c', startedAt: NOW - DAY, finishedAt: NOW - DAY + 3_600_000 }],
      sessionExercises: [{ id: 'c-e0', sessionId: 'c', exerciseId: 'running', order: 0 }],
      cardioEntries: [
        {
          id: 'c-e0-c0',
          sessionExerciseId: 'c-e0',
          order: 0,
          durationSec: 1800,
          intensity: 'relaxed',
          completedAt: NOW - DAY,
        },
      ],
    };
    const v = analyzeView(makeInput(d), NOW);
    expect(v.result.current.muscles.quads.sets).toBe(3);
    expect(v.summary.totalSets).toBeGreaterThan(0);
  });

  it('analysis matches analyzeView', () => {
    const input = makeInput(data());
    const { result, suggestions, empty } = analyzeView(input, NOW);
    expect(analysis(input, NOW)).toEqual({ result, suggestions, empty });
  });
});
