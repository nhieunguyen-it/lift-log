import type { Exercise } from '@/data';
import { activeMs } from '@/lib/workoutTimer';
import { db, newId } from './db';
import type { Session, SessionExercise, SessionSummary, SetRow } from './types';

export interface SessionExerciseDetail {
  sessionExercise: SessionExercise;
  exercise: Exercise | undefined;
  sets: SetRow[];
}

export interface SessionDetail {
  session: Session;
  exercises: SessionExerciseDetail[];
}

export interface HistoryItem {
  session: Session;
  summary: SessionSummary;
  exerciseNames: string[];
}

export async function getActiveSession(): Promise<Session | undefined> {
  const active = await db.sessions.filter((s) => s.finishedAt === undefined).toArray();
  active.sort((a, b) => b.startedAt - a.startedAt);
  return active[0];
}

/** Starts a session; if one is already active returns it instead. */
export async function startSession(now = Date.now()): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const active = await getActiveSession();
    if (active) return active;
    const s: Session = { id: newId(), startedAt: now };
    await db.sessions.add(s);
    return s;
  });
}

async function orderedExercises(sessionId: string): Promise<SessionExercise[]> {
  const rows = await db.sessionExercises.where('sessionId').equals(sessionId).toArray();
  return rows.sort((a, b) => a.order - b.order);
}

async function renumberExercises(sessionId: string): Promise<void> {
  const rows = await orderedExercises(sessionId);
  await Promise.all(
    rows.map((r, i) =>
      r.order === i ? undefined : db.sessionExercises.update(r.id, { order: i }),
    ),
  );
}

export async function addExercise(sessionId: string, exerciseId: string): Promise<SessionExercise> {
  return db.transaction('rw', db.sessionExercises, async () => {
    const rows = await orderedExercises(sessionId);
    const row: SessionExercise = { id: newId(), sessionId, exerciseId, order: rows.length };
    await db.sessionExercises.add(row);
    return row;
  });
}

export async function moveExercise(sessionExerciseId: string, dir: 'up' | 'down'): Promise<void> {
  await db.transaction('rw', db.sessionExercises, async () => {
    const se = await db.sessionExercises.get(sessionExerciseId);
    if (!se) return;
    const rows = await orderedExercises(se.sessionId);
    const i = rows.findIndex((r) => r.id === sessionExerciseId);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    await Promise.all(rows.map((r, idx) => db.sessionExercises.update(r.id, { order: idx })));
  });
}

export async function removeExercise(sessionExerciseId: string): Promise<void> {
  await db.transaction('rw', [db.sessionExercises, db.sets], async () => {
    const se = await db.sessionExercises.get(sessionExerciseId);
    if (!se) return;
    await db.sets.where('sessionExerciseId').equals(sessionExerciseId).delete();
    await db.sessionExercises.delete(sessionExerciseId);
    await renumberExercises(se.sessionId);
  });
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | undefined> {
  const session = await db.sessions.get(sessionId);
  if (!session) return undefined;
  const ses = await orderedExercises(sessionId);
  const exercises = await Promise.all(
    ses.map(async (sessionExercise) => {
      const [exercise, sets] = await Promise.all([
        db.exercises
          .get(sessionExercise.exerciseId)
          .then((e) => e ?? db.customExercises.get(sessionExercise.exerciseId)),
        db.sets.where('sessionExerciseId').equals(sessionExercise.id).toArray(),
      ]);
      sets.sort((a, b) => a.order - b.order);
      return { sessionExercise, exercise, sets };
    }),
  );
  return { session, exercises };
}

/** Pure summary computation. Working set = non-warmup and completed. */
export function summarize(detail: SessionDetail, now = Date.now()): SessionSummary {
  const end = detail.session.finishedAt ?? now;
  let workingSets = 0;
  let volumeKg = 0;
  for (const e of detail.exercises) {
    for (const s of e.sets) {
      if (s.isWarmup || s.completedAt === undefined) continue;
      workingSets += 1;
      volumeKg += (s.weightKg ?? 0) * s.reps;
    }
  }
  return {
    durationMs: activeMs(detail.session, end),
    exerciseCount: detail.exercises.length,
    workingSets,
    volumeKg,
  };
}

export async function finishSession(
  sessionId: string,
  now = Date.now(),
): Promise<SessionSummary | undefined> {
  // Finishing twice keeps the original end time. An open pause is closed at `now`.
  await db.sessions
    .where('id')
    .equals(sessionId)
    .filter((s) => s.finishedAt === undefined)
    .modify((s) => {
      s.finishedAt = now;
      if (s.pausedAt !== undefined) {
        s.pausedMs = (s.pausedMs ?? 0) + Math.max(0, now - s.pausedAt);
        delete s.pausedAt;
      }
    });
  const detail = await getSessionDetail(sessionId);
  return detail && summarize(detail, detail.session.finishedAt ?? now);
}

/** Starts a pause. No-op if the session is finished or already paused. */
export async function pauseSession(sessionId: string, now = Date.now()): Promise<void> {
  await db.sessions
    .where('id')
    .equals(sessionId)
    .filter((s) => s.finishedAt === undefined && s.pausedAt === undefined)
    .modify({ pausedAt: now });
}

/** Ends the current pause. No-op if the session is not paused. */
export async function resumeSession(sessionId: string, now = Date.now()): Promise<void> {
  await db.sessions
    .where('id')
    .equals(sessionId)
    .filter((s) => s.finishedAt === undefined && s.pausedAt !== undefined)
    .modify((s) => {
      s.pausedMs = (s.pausedMs ?? 0) + Math.max(0, now - (s.pausedAt ?? now));
      delete s.pausedAt;
    });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.transaction('rw', [db.sessions, db.sessionExercises, db.sets], async () => {
    const ses = await db.sessionExercises.where('sessionId').equals(sessionId).toArray();
    for (const se of ses) await db.sets.where('sessionExerciseId').equals(se.id).delete();
    await db.sessionExercises.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}

/** Finished sessions, newest first. */
export async function listHistory(): Promise<HistoryItem[]> {
  const sessions = (await db.sessions.orderBy('startedAt').reverse().toArray()).filter(
    (s) => s.finishedAt !== undefined,
  );
  const items: HistoryItem[] = [];
  for (const s of sessions) {
    const detail = await getSessionDetail(s.id);
    if (!detail) continue;
    items.push({
      session: s,
      summary: summarize(detail),
      exerciseNames: detail.exercises.map((e) => e.exercise?.name ?? e.sessionExercise.exerciseId),
    });
  }
  return items;
}

/** Changes the exercise of a session exercise in place; sets and order are kept. */
export async function swapExercise(
  sessionExerciseId: string,
  newExerciseId: string,
): Promise<void> {
  await db.sessionExercises.update(sessionExerciseId, { exerciseId: newExerciseId });
}
