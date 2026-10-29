import { isPaused } from '@/lib/workoutTimer';
import { db, newId } from './db';
import { resumeSession } from './sessionsRepo';
import type { SetRow } from './types';

export type SetPatch = Partial<
  Pick<SetRow, 'weightKg' | 'reps' | 'rir' | 'isWarmup' | 'completedAt'>
>;

type Prefill = Pick<SetRow, 'weightKg' | 'reps' | 'rir'>;

/**
 * Pure prefill rule. `current` are the sets already in this exercise (ordered);
 * `previous` are the sets of the most recent earlier session (ordered).
 */
export function pickPrefill(current: SetRow[], previous: SetRow[]): Prefill {
  const src = (s: SetRow): Prefill => ({ weightKg: s.weightKg, reps: s.reps, rir: s.rir });
  const currentWorking = current.filter((s) => !s.isWarmup);
  if (currentWorking.length > 0) return src(currentWorking[currentWorking.length - 1]);
  if (previous.length > 0) {
    const working = previous.filter((s) => !s.isWarmup);
    return src((working.length > 0 ? working : previous)[0]);
  }
  if (current.length > 0) return src(current[current.length - 1]);
  return { reps: 0 };
}

async function orderedSets(sessionExerciseId: string): Promise<SetRow[]> {
  const rows = await db.sets.where('sessionExerciseId').equals(sessionExerciseId).toArray();
  return rows.sort((a, b) => a.order - b.order);
}

async function renumber(sessionExerciseId: string): Promise<void> {
  const rows = await orderedSets(sessionExerciseId);
  await Promise.all(
    rows.map((s, i) => (s.order === i ? undefined : db.sets.update(s.id, { order: i }))),
  );
}

/** Sets of the most recent other session containing this exercise (with sets). */
async function previousSessionSets(sessionExerciseId: string): Promise<SetRow[]> {
  const se = await db.sessionExercises.get(sessionExerciseId);
  if (!se) return [];
  const [current, all] = await Promise.all([
    db.sessions.get(se.sessionId),
    db.sessionExercises.where('exerciseId').equals(se.exerciseId).toArray(),
  ]);
  const candidates: { se: (typeof all)[number]; startedAt: number }[] = [];
  for (const other of all) {
    if (other.sessionId === se.sessionId) continue;
    const s = await db.sessions.get(other.sessionId);
    if (!s) continue;
    if (current && s.startedAt > current.startedAt) continue;
    candidates.push({ se: other, startedAt: s.startedAt });
  }
  candidates.sort((a, b) => b.startedAt - a.startedAt);
  for (const c of candidates) {
    const sets = await orderedSets(c.se.id);
    if (sets.length > 0) return sets;
  }
  return [];
}

export async function getPrefill(sessionExerciseId: string): Promise<Prefill> {
  const current = await orderedSets(sessionExerciseId);
  const previous = current.length > 0 ? [] : await previousSessionSets(sessionExerciseId);
  return pickPrefill(current, previous);
}

export async function addSet(sessionExerciseId: string): Promise<SetRow> {
  return db.transaction('rw', [db.sets, db.sessionExercises, db.sessions], async () => {
    const current = await orderedSets(sessionExerciseId);
    const previous = current.length > 0 ? [] : await previousSessionSets(sessionExerciseId);
    const row: SetRow = {
      id: newId(),
      sessionExerciseId,
      order: current.length,
      ...pickPrefill(current, previous),
      isWarmup: false,
    };
    if (row.weightKg === undefined) delete row.weightKg;
    if (row.rir === undefined) delete row.rir;
    await db.sets.add(row);
    return row;
  });
}

export async function duplicateSet(setId: string): Promise<SetRow | undefined> {
  return db.transaction('rw', db.sets, async () => {
    const src = await db.sets.get(setId);
    if (!src) return undefined;
    const rows = await orderedSets(src.sessionExerciseId);
    const idx = rows.findIndex((r) => r.id === setId);
    await Promise.all(rows.slice(idx + 1).map((r) => db.sets.update(r.id, { order: r.order + 1 })));
    const copy: SetRow = { ...src, id: newId(), order: src.order + 1 };
    delete copy.completedAt;
    await db.sets.add(copy);
    return copy;
  });
}

export async function updateSet(setId: string, patch: SetPatch): Promise<void> {
  // A set with 0 reps can't count as done.
  await db.sets.update(setId, patch.reps === 0 ? { ...patch, completedAt: undefined } : patch);
}

export async function setDone(setId: string, done: boolean, patch: SetPatch = {}): Promise<void> {
  const markDone = done && patch.reps !== 0;
  // Deliberately not one db.transaction: an explicit transaction defers live-query
  // delivery via setTimeout(0). Each write is atomic and resumeSession only acts
  // on a paused, unfinished session, so the sequence is safe. The transactional form
  // also starves under Playwright's fake clock (Dexie delivers live-query results via
  // setTimeout(0)); production is unaffected, so don't restore the transaction.
  const completedAt = markDone ? Date.now() : undefined;
  await db.sets.update(setId, { ...patch, completedAt });
  if (completedAt === undefined) return;
  // Ticking a set while paused means the lifter is training again.
  const set = await db.sets.get(setId);
  const se = set && (await db.sessionExercises.get(set.sessionExerciseId));
  const session = se && (await db.sessions.get(se.sessionId));
  if (session && session.finishedAt === undefined && isPaused(session)) {
    await resumeSession(session.id, completedAt);
  }
}

export async function deleteSet(setId: string): Promise<void> {
  await db.transaction('rw', db.sets, async () => {
    const s = await db.sets.get(setId);
    if (!s) return;
    await db.sets.delete(setId);
    await renumber(s.sessionExerciseId);
  });
}

export { orderedSets as listSets };
