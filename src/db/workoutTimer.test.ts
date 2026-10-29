import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exercises } from '@/data';
import { db } from './db';
import { resetDb } from './testUtils';
import * as sessions from './sessionsRepo';
import * as sets from './setsRepo';

const [A] = exercises.map((e) => e.id);

beforeEach(resetDb);
afterEach(() => {
  vi.useRealTimers();
});

async function sessionWithSet(): Promise<{ sessionId: string; setId: string }> {
  const s = await sessions.startSession(0);
  const se = await sessions.addExercise(s.id, A);
  const set = await sets.addSet(se.id);
  await sets.updateSet(set.id, { reps: 5 });
  return { sessionId: s.id, setId: set.id };
}

describe('session pause state', () => {
  it('pause/resume accumulates pausedMs; repeats are no-ops', async () => {
    const s = await sessions.startSession(0);
    await sessions.pauseSession(s.id, 10);
    await sessions.pauseSession(s.id, 20); // no-op
    await sessions.resumeSession(s.id, 50);
    await sessions.resumeSession(s.id, 60); // no-op
    const row = await db.sessions.get(s.id);
    expect(row?.pausedMs).toBe(40);
    expect(row && 'pausedAt' in row).toBe(false);
  });

  it('cannot pause a finished session', async () => {
    const s = await sessions.startSession(0);
    await sessions.finishSession(s.id, 100);
    await sessions.pauseSession(s.id, 200);
    expect((await db.sessions.get(s.id))?.pausedAt).toBeUndefined();
  });

  it('finish while paused closes the pause; duration is active time', async () => {
    const s = await sessions.startSession(0);
    await sessions.pauseSession(s.id, 1_000);
    const summary = await sessions.finishSession(s.id, 4_000);
    const row = await db.sessions.get(s.id);
    expect(row?.pausedAt).toBeUndefined();
    expect(row?.pausedMs).toBe(3_000);
    expect(summary?.durationMs).toBe(1_000);
  });

  it('stale finish at an earlier time ignores a later open pause', async () => {
    const s = await sessions.startSession(0);
    await sessions.pauseSession(s.id, 5_000);
    const summary = await sessions.finishSession(s.id, 2_000);
    expect(summary?.durationMs).toBe(2_000);
    expect((await db.sessions.get(s.id))?.pausedAt).toBeUndefined();
  });

  it('summarize subtracts closed and open pauses', async () => {
    const s = await sessions.startSession(0);
    await sessions.pauseSession(s.id, 10);
    await sessions.resumeSession(s.id, 30);
    await sessions.pauseSession(s.id, 80);
    const detail = await sessions.getSessionDetail(s.id);
    expect(detail && sessions.summarize(detail, 100).durationMs).toBe(60);
  });

  it('ticking a set done auto-resumes at completedAt', async () => {
    vi.useFakeTimers({ now: 0, toFake: ['Date'] });
    const { sessionId, setId } = await sessionWithSet();
    await sessions.pauseSession(sessionId, 10);
    vi.setSystemTime(70);
    await sets.setDone(setId, true);
    const row = await db.sessions.get(sessionId);
    expect(row?.pausedAt).toBeUndefined();
    expect(row?.pausedMs).toBe(60);
  });

  it('un-ticking a set while paused stays paused', async () => {
    const { sessionId, setId } = await sessionWithSet();
    await sessions.pauseSession(sessionId, 10);
    await sets.setDone(setId, false);
    expect((await db.sessions.get(sessionId))?.pausedAt).toBe(10);
  });

  it('ticking a set in a finished session leaves pause fields alone', async () => {
    const { sessionId, setId } = await sessionWithSet();
    await sessions.finishSession(sessionId, 100);
    const snapshot = await db.sessions.get(sessionId);
    await sets.setDone(setId, true);
    expect(await db.sessions.get(sessionId)).toEqual(snapshot);
  });
});
