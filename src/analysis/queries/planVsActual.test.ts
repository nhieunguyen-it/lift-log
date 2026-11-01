import { describe, expect, it } from 'vitest';
import { exercises } from '@/data';
import type { MergedExercise } from '@/data/merged';
import { defaultRampExerciseIds, newBlock } from '@/program/block';
import { getBuiltInProgram } from '@/program/templates';
import type { Program } from '@/program/types';
import { makeData, makeSession } from '../engine/fixtures';
import { planVsActual } from './planVsActual';
import { makeInput } from './testInput';

const DAY = 86_400_000;
const wed = new Date(2026, 2, 4, 18).getTime();
const program = getBuiltInProgram('builtin-full-body')!;

const quads = (v: ReturnType<typeof planVsActual>) =>
  v!.result.muscles.find((m) => m.muscleId === 'quads')!.planned;

describe('planVsActual', () => {
  it('null without an active program', () => {
    expect(planVsActual(makeInput(makeData()), wed)).toBeNull();
  });

  it('uses the block week and lists days not done', () => {
    const parts = makeSession('s1', wed, [
      { exerciseId: 'barbell-bench-press', sets: [{ weightKg: 60, reps: 8 }] },
    ]);
    parts.sessions[0] = {
      ...parts.sessions[0],
      programId: 'builtin-full-body',
      programDayId: 'fb-a',
      finishedAt: wed + 3_600_000,
    };
    const data = makeData(parts);
    const block = newBlock(wed, 1, defaultRampExerciseIds(program));
    const plain = planVsActual(
      makeInput(data, { now: wed, program: { active: program, blocks: {} } }),
      wed,
    );
    const input = (now: number) =>
      makeInput(data, {
        now,
        program: { active: program, blocks: { 'builtin-full-body': block } },
      });
    const w1 = planVsActual(input(wed), wed);
    expect(w1?.blockWeek).toBe(1);
    expect(w1?.result.daysDone).toBe(1);
    expect(w1?.result.days.filter((d) => !d.done).map((d) => d.dayId)).toEqual(['fb-b', 'fb-c']);
    expect(w1?.inProgress).toBe(true);
    expect(quads(w1)).toBe(quads(plain));
    const w2 = planVsActual(input(wed + 14 * DAY), wed + 7 * DAY);
    expect(w2?.blockWeek).toBe(2);
    expect(quads(w2)).toBeGreaterThan(quads(w1));
    expect(w2?.inProgress).toBe(false);
    expect(w2?.result.daysSkipped).toBe(3);
  });

  it('excludes tombstoned customs from the plan', () => {
    const custom = (deletedAt?: number): MergedExercise => ({
      ...exercises[0],
      id: 'custom-x',
      name: 'Custom X',
      isCustom: true,
      ...(deletedAt !== undefined ? { deletedAt } : {}),
    });
    const user: Program = {
      id: 'p1',
      name: 'Mine',
      builtIn: false,
      days: [{ id: 'd1', name: 'D1', exercises: [{ exerciseId: 'custom-x', targetSets: 4 }] }],
      createdAt: 0,
      updatedAt: 0,
    };
    const run = (deletedAt?: number) => {
      const base = makeData();
      const data = {
        ...base,
        exercises: [...base.exercises, custom(deletedAt)],
        exerciseMuscles: [
          ...base.exerciseMuscles,
          { exerciseId: 'custom-x', muscleId: 'biceps' as const, weight: 1 },
        ],
      };
      return planVsActual(makeInput(data, { program: { active: user, blocks: {} } }), wed)!;
    };
    expect(run(1).result.muscles.every((m) => m.planned === 0)).toBe(true);
    expect(run().result.muscles.find((m) => m.muscleId === 'biceps')!.planned).toBeGreaterThan(0);
  });
});
