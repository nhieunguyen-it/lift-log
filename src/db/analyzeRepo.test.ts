import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeData, makeSession } from '@/analyzer/fixtures';
import { db } from './db';
import { ensureSeed } from './seed';
import { activateProgram, addDayToProgram, createProgram, getActiveProgram } from './programsRepo';
import { getAnalyzeView } from './analyzeRepo';
import { getAnalyzeGrouping, setAnalyzeGrouping } from './settingsRepo';

const DAY = 86_400_000;
// Wednesday 7 Jan 2026 noon; week starts Monday by default.
const NOW = new Date(2026, 0, 7, 12).getTime();

const bench = (n: number) => ({
  exerciseId: 'barbell-bench-press',
  sets: Array(n).fill({ weightKg: 60, reps: 8 }),
});

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureSeed();
});

describe('getAnalyzeView', () => {
  it('summarises this week against last and counts sessions with a program', async () => {
    const d = makeData(
      makeSession('cur', NOW - DAY, [bench(4)]),
      makeSession('prev', NOW - 7 * DAY, [bench(3)]),
    );
    await db.sessions.bulkAdd(d.sessions);
    await db.sessionExercises.bulkAdd(d.sessionExercises);
    await db.sets.bulkAdd(d.sets);

    const none = await getAnalyzeView(NOW);
    expect(none.summary.sessions).toBeUndefined();
    expect(none.summary.totalSets).toBe(4);
    expect(none.summary.previousTotalSets).toBe(3);
    expect(none.summary.delta).toBe(1);
    expect(none.empty).toBe(false);

    const p = await createProgram('P', NOW);
    await addDayToProgram(p.id);
    await activateProgram(p.id);
    const withProgram = await getAnalyzeView(NOW);
    const active = await getActiveProgram();
    expect(withProgram.summary.sessions).toEqual({ done: 1, planned: active!.days.length });
  });

  it('remembers the grouping', async () => {
    expect(await getAnalyzeGrouping()).toBe('muscle');
    await setAnalyzeGrouping('group');
    expect(await getAnalyzeGrouping()).toBe('group');
  });
});
