import { describe, expect, it } from 'vitest';
import { exercises, exerciseMuscles, MUSCLE_IDS } from '@/data';
import type { Equipment, MuscleId } from '@/data';
import { TRAINING } from '@/config/training';
import type { ExerciseSessionSets, MuscleWeek, WeekAnalysis } from '@/analyzer/types';
import {
  alternatives,
  cosineSimilarity,
  loadStepCategory,
  nextTarget,
  repRangeFor,
  volumeSuggestions,
} from './index';

const ex = (id: string) => {
  const e = exercises.find((x) => x.id === id);
  if (!e) throw new Error(`missing ${id}`);
  return e;
};
const primary = (id: string): MuscleId[] =>
  exerciseMuscles.filter((m) => m.exerciseId === id && m.weight === 1).map((m) => m.muscleId);

const sess = (sets: Array<[number | undefined, number, number?]>, i = 0): ExerciseSessionSets => ({
  sessionId: `s${i}`,
  startedAt: 1000 - i,
  sets: sets.map(([weightKg, reps, rir]) => ({ weightKg, reps, rir })),
});

function target(id: string, history: ExerciseSessionSets[], unit: 'kg' | 'lbs' = 'kg') {
  return nextTarget({ exercise: ex(id), primaryMuscleIds: primary(id), history, unit });
}

describe('repRangeFor', () => {
  it('categorises', () => {
    expect(repRangeFor(ex('barbell-bench-press'))).toEqual({ min: 5, max: 10 });
    expect(repRangeFor(ex('push-up'))).toEqual({ min: 8, max: 20 });
    const iso = exercises.find(
      (e) => e.mechanic === 'isolation' && !e.isBodyweight && !TRAINING.repRangeOverrides[e.id],
    )!;
    expect(repRangeFor(iso)).toEqual({ min: 10, max: 20 });
    expect(repRangeFor(ex('deadlift'))).toEqual({ min: 3, max: 8 });
  });
});

describe('loadStepCategory', () => {
  it('maps', () => {
    expect(loadStepCategory(ex('barbell-bench-press'), primary('barbell-bench-press'))).toBe(
      'upperBarbell',
    );
    expect(loadStepCategory(ex('barbell-back-squat'), primary('barbell-back-squat'))).toBe(
      'lowerBarbell',
    );
    expect(loadStepCategory(ex('dumbbell-bench-press'), primary('dumbbell-bench-press'))).toBe(
      'dumbbell',
    );
  });
});

describe('nextTarget', () => {
  it('starts with no history', () => {
    const t = target('barbell-bench-press', []);
    expect(t.action).toBe('start');
    expect(t.targetReps).toBe(5);
    expect(t.weightKg).toBeUndefined();
  });
  it('bench at top -> +2.5 kg', () => {
    const t = target('barbell-bench-press', [
      sess([
        [80, 10, 2],
        [80, 10, 2],
      ]),
    ]);
    expect(t.action).toBe('increase_weight');
    expect(t.weightKg).toBe(82.5);
    expect(t.label).toBe('Target: 82.5 kg × 5–10');
  });
  it('squat at top -> +5 kg', () => {
    expect(
      target('barbell-back-squat', [
        sess([
          [100, 10],
          [100, 10],
        ]),
      ]).weightKg,
    ).toBe(105);
  });
  it('dumbbell -> +1 kg', () => {
    expect(
      target('dumbbell-bench-press', [
        sess([
          [30, 10],
          [30, 10],
        ]),
      ]).weightKg,
    ).toBe(31);
  });
  it('lbs user bench -> +5 lb whole', () => {
    const t = target('barbell-bench-press', [sess([[100, 10, 2]])], 'lbs');
    expect(t.displayWeight).toBe(225);
    expect(Number.isInteger(t.displayWeight)).toBe(true);
    expect(t.unit).toBe('lbs');
  });
  it('RIR above target does not increase', () => {
    const t = target('barbell-bench-press', [sess([[80, 10, 5]])]);
    expect(t.action).not.toBe('increase_weight');
  });
  it('holds after 2 misses, deloads after 3', () => {
    const miss = (i: number) =>
      sess(
        [
          [80, 4],
          [80, 5],
        ],
        i,
      );
    expect(target('barbell-bench-press', [miss(0), miss(1)]).action).toBe('hold');
    const d = target('barbell-bench-press', [miss(0), miss(1), miss(2)]);
    expect(d.action).toBe('deload');
    expect(d.weightKg).toBe(72);
  });
  it('add_rep uses min reps + 1', () => {
    const t = target('barbell-bench-press', [
      sess([
        [80, 7],
        [80, 6],
      ]),
    ]);
    expect(t.action).toBe('add_rep');
    expect(t.targetReps).toBe(7);
    expect(t.weightKg).toBe(80);
  });
  it('bodyweight', () => {
    expect(
      target('push-up', [
        sess([
          [undefined, 20],
          [undefined, 20],
        ]),
      ]).action,
    ).toBe('add_load_or_variant');
    const t = target('push-up', [
      sess([
        [undefined, 12],
        [undefined, 10],
      ]),
    ]);
    expect(t.action).toBe('add_reps_bodyweight');
    expect(t.targetReps).toBe(11);
    expect(t.label).toBe('Target: 11–20 reps');
  });
});

const ALL: Equipment[] = ['barbell', 'dumbbell', 'cable', 'machine', 'kettlebell', 'band', 'other'];

function weekWith(sets: Partial<Record<MuscleId, number>>): WeekAnalysis {
  const muscles = Object.fromEntries(
    MUSCLE_IDS.map((m) => {
      const s = sets[m] ?? TRAINING.targets[m].mavLow;
      const mw: MuscleWeek = {
        muscleId: m,
        sets: s,
        status: 'optimal',
        target: TRAINING.targets[m],
        contributions: [],
      };
      return [m, mw];
    }),
  ) as Record<MuscleId, MuscleWeek>;
  return { window: { start: 0, end: 1 }, muscles, exercisesDone: [] };
}

describe('volumeSuggestions', () => {
  it('suggests adds below MEV, sorted by gap, and flags over MRV', () => {
    const res = volumeSuggestions({
      week: weekWith({ chest: 2.5, biceps: 6, quads: 30 }),
      exercises,
      exerciseMuscles,
      availableEquipment: ALL,
    });
    const kinds = res.map((r) => r.kind);
    expect(kinds).toEqual(['add', 'add', 'over']);
    const first = res[0]!;
    expect(first.kind === 'add' && first.muscleId).toBe('chest');
    if (first.kind === 'add') {
      expect(first.setsToAdd).toBe(6);
      expect(first.exercises).toHaveLength(3);
      expect(first.exercises[0]!.muscleWeight).toBeGreaterThanOrEqual(
        first.exercises[2]!.muscleWeight,
      );
    }
    expect(res[2]).toMatchObject({ kind: 'over', muscleId: 'quads', mrv: 22 });
  });
  it('filters by equipment (bodyweight always available)', () => {
    const res = volumeSuggestions({
      week: weekWith({ chest: 0 }),
      exercises,
      exerciseMuscles,
      availableEquipment: [],
    });
    const add = res[0]!;
    expect(add.kind).toBe('add');
    if (add.kind === 'add') {
      expect(add.exercises.length).toBeGreaterThan(0);
      for (const s of add.exercises) expect(ex(s.exerciseId).equipment).toBe('bodyweight');
    }
  });
});

describe('alternatives', () => {
  const base = {
    exerciseId: 'barbell-bench-press',
    availableEquipment: ALL,
    exercisesDoneThisWeek: [] as string[],
    exercises,
    exerciseMuscles,
  };
  it('returns chest presses, excluding self', () => {
    const res = alternatives(base);
    expect(res).toHaveLength(TRAINING.alternatives.limit);
    expect(res.some((r) => r.exerciseId === 'barbell-bench-press')).toBe(false);
    for (const r of res) expect(r.exerciseId).toMatch(/press|bench|chest|push/);
    expect(res.every((r, i) => i === 0 || res[i - 1]!.score >= r.score)).toBe(true);
  });
  it('excludes unavailable equipment', () => {
    const res = alternatives({ ...base, availableEquipment: ['dumbbell'] });
    for (const r of res) expect(['dumbbell', 'bodyweight']).toContain(ex(r.exerciseId).equipment);
  });
  it('penalty reorders', () => {
    const top = alternatives(base)[0]!;
    const res = alternatives({ ...base, exercisesDoneThisWeek: [top.exerciseId] });
    const again = res.find((r) => r.exerciseId === top.exerciseId);
    expect(res[0]!.exerciseId).not.toBe(top.exerciseId);
    if (again) expect(again.doneThisWeek).toBe(true);
  });
  it('cosine of identical vectors is 1', () => {
    expect(cosineSimilarity({ a: 1, b: 0.5 }, { a: 1, b: 0.5 })).toBeCloseTo(1);
    expect(cosineSimilarity({ a: 1 }, { b: 1 })).toBe(0);
  });
});
