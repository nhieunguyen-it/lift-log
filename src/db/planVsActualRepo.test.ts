import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from './testUtils';
import * as programs from './programsRepo';
import { getPlanVsActual } from './planVsActualRepo';

beforeEach(resetDb);

const DAY = 86_400_000;
const wed = new Date(2026, 2, 4, 18).getTime();

describe('getPlanVsActual', () => {
  it('null without an active program', async () => {
    expect(await getPlanVsActual(wed, wed)).toBeNull();
  });

  it('uses the block week plan and lists the days not done', async () => {
    await programs.activateProgram('builtin-full-body');
    const plain = await getPlanVsActual(wed, wed);
    await programs.startBlock('builtin-full-body', { now: wed });
    await programs.startProgramDay('builtin-full-body', 'fb-a', wed);
    const w1 = await getPlanVsActual(wed, wed);
    expect(w1?.blockWeek).toBe(1);
    expect(w1?.result.daysDone).toBe(1);
    expect(w1?.result.days.filter((d) => !d.done).map((d) => d.dayId)).toEqual(['fb-b', 'fb-c']);
    expect(w1?.inProgress).toBe(true);
    const quads = (v: typeof w1) => v!.result.muscles.find((m) => m.muscleId === 'quads')!.planned;
    expect(quads(w1)).toBe(quads(plain));
    // Week 2: the ramped squat gains a set on each day it appears.
    const w2 = await getPlanVsActual(wed + 7 * DAY, wed + 14 * DAY);
    expect(w2?.blockWeek).toBe(2);
    expect(quads(w2)).toBeGreaterThan(quads(w1));
    expect(w2?.inProgress).toBe(false);
    expect(w2?.result.daysSkipped).toBe(3);
  });
});
