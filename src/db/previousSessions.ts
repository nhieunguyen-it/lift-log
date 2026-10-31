import { db } from './db';

/**
 * Ids of the sessionExercises of the same exercise in earlier sessions (not the current one,
 * not later ones), most recent session first. Shared by the sets and cardio prefill rules.
 */
export async function earlierSessionExerciseIds(sessionExerciseId: string): Promise<string[]> {
  const se = await db.sessionExercises.get(sessionExerciseId);
  if (!se) return [];
  const [current, all] = await Promise.all([
    db.sessions.get(se.sessionId),
    db.sessionExercises.where('exerciseId').equals(se.exerciseId).toArray(),
  ]);
  const candidates: { id: string; startedAt: number }[] = [];
  for (const other of all) {
    if (other.sessionId === se.sessionId) continue;
    const s = await db.sessions.get(other.sessionId);
    if (!s) continue;
    if (current && s.startedAt > current.startedAt) continue;
    candidates.push({ id: other.id, startedAt: s.startedAt });
  }
  candidates.sort((a, b) => b.startedAt - a.startedAt);
  return candidates.map((c) => c.id);
}
