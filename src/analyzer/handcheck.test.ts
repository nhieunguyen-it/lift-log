import { describe, expect, it } from 'vitest';
import { analyzeWeek, defaultAnalyzerOptions, weekWindow } from './index';
import { makeData, makeSession } from './fixtures';
import { nextTarget, volumeSuggestions } from '@/recommend';
import { exerciseMuscles, exercises } from '@/data';

// Orchestrator hand-calculated scenarios (independent of the agents' tests).
const MON = new Date(2026, 9, 19, 18, 0).getTime(); // Mon 19 Oct 2026, 18:00 local
const opts = defaultAnalyzerOptions();
const w = weekWindow(MON, 1);
const set = (weightKg: number, reps: number, rir?: number, isWarmup = false) => ({
  weightKg,
  reps,
  rir,
  isWarmup,
  completedAt: MON + 60_000,
});

describe('hand-checked scenarios', () => {
  it('bench 4 sets + 1 warm-up', () => {
    const d = makeData(
      makeSession('a', MON, [
        {
          exerciseId: 'barbell-bench-press',
          sets: [
            set(40, 10, undefined, true),
            set(80, 8, 2),
            set(80, 8, 2),
            set(80, 7, 1),
            set(80, 6, 0),
          ],
        },
      ]),
    );
    const r = analyzeWeek(d, w, opts).muscles;
    expect([r.chest.sets, r.triceps.sets, r.front_delts.sets]).toEqual([4, 2, 2]);
    expect(r.chest.status).toBe('below');
  });
  it('squat 5 + RDL 4 (one at rir 5) + lateral raise 3 next day; Sunday session', () => {
    const d = makeData(
      makeSession('a', MON, [
        { exerciseId: 'barbell-back-squat', sets: Array.from({ length: 5 }, () => set(100, 5, 2)) },
        {
          exerciseId: 'romanian-deadlift',
          sets: [set(80, 8, 2), set(80, 8, 2), set(80, 8, 2), set(80, 8, 5)],
        },
      ]),
      makeSession('b', MON + 6 * 86400000 + 5 * 3600000, [
        { exerciseId: 'dumbbell-lateral-raise', sets: [set(10, 15), set(10, 15), set(10, 15)] },
      ]),
    );
    const r = analyzeWeek(d, w, opts).muscles;
    expect({
      q: r.quads.sets,
      g: r.glutes.sets,
      h: r.hamstrings.sets,
      sd: r.side_delts.sets,
    }).toEqual({ q: 5, g: 6, h: 5.5, sd: 3 });
  });
  it('bench at top of range → 82.5 kg', () => {
    const ex = exercises.find((e) => e.id === 'barbell-bench-press')!;
    const t = nextTarget({
      exercise: ex,
      primaryMuscleIds: ['chest'],
      unit: 'kg',
      history: [
        {
          sessionId: 'a',
          startedAt: MON,
          sets: [
            { weightKg: 80, reps: 10, rir: 2 },
            { weightKg: 80, reps: 10, rir: 1 },
          ],
        },
      ],
    });
    expect(t.action).toBe('increase_weight');
    expect(t.label).toBe('Target: 82.5 kg × 5–10');
  });
  it('review fixes: 0-rep completed set not counted; float gap does not over-round', () => {
    const d = makeData(
      makeSession('a', MON, [
        { exerciseId: 'barbell-bench-press', sets: [set(80, 0), set(80, 8)] },
        // Push-ups add chest volume; abs total is forced below to a float just under 5.
        { exerciseId: 'push-up', sets: Array.from({ length: 28 }, () => set(0, 12)) },
      ]),
    );
    const week = analyzeWeek(d, w, opts);
    expect(week.muscles.chest.sets).toBe(29);
    const s = volumeSuggestions({
      week: {
        ...week,
        muscles: { ...week.muscles, abs: { ...week.muscles.abs, sets: 4.999999999999999 } },
      },
      exercises,
      exerciseMuscles,
      availableEquipment: ['bodyweight'],
    }).find((x) => x.muscleId === 'abs');
    expect(s?.kind === 'add' && s.setsToAdd).toBe(1);
  });
});
