import { estimateDistanceKm, isCountedEntry } from '@/analyzer/cardio';
import { TRAINING } from '@/config/training';
import { db, newId } from './db';
import { earlierSessionExerciseIds } from './previousSessions';
import type { CardioEntry, CardioIntensity } from './types';

export type CardioPatch = Partial<Pick<CardioEntry, 'durationSec' | 'intensity'>>;

export interface CardioHistoryItem {
  sessionId: string;
  startedAt: number;
  minutes: number;
  intensity: CardioIntensity;
  distanceKm?: number;
}

/** Whole minutes, 1..max. */
export function clampMinutes(n: number): number {
  return Math.min(TRAINING.cardio.maxMinutes, Math.max(1, Math.round(n)));
}

async function orderedEntries(sessionExerciseId: string): Promise<CardioEntry[]> {
  const rows = await db.cardioEntries
    .where('sessionExerciseId')
    .equals(sessionExerciseId)
    .toArray();
  return rows.sort((a, b) => a.order - b.order);
}

async function renumber(sessionExerciseId: string): Promise<void> {
  const rows = await orderedEntries(sessionExerciseId);
  await Promise.all(
    rows.map((e, i) => (e.order === i ? undefined : db.cardioEntries.update(e.id, { order: i }))),
  );
}

/** Last entry of the most recent other session containing this exercise (with entries). */
async function previousLastEntry(sessionExerciseId: string): Promise<CardioEntry | undefined> {
  for (const id of await earlierSessionExerciseIds(sessionExerciseId)) {
    const rows = await orderedEntries(id);
    if (rows.length > 0) return rows[rows.length - 1];
  }
  return undefined;
}

export { orderedEntries as listEntries };

export async function addEntry(sessionExerciseId: string): Promise<CardioEntry> {
  return db.transaction('rw', [db.cardioEntries, db.sessionExercises, db.sessions], async () => {
    const current = await orderedEntries(sessionExerciseId);
    const src =
      current.length > 0 ? current[current.length - 1] : await previousLastEntry(sessionExerciseId);
    const row: CardioEntry = {
      id: newId(),
      sessionExerciseId,
      order: current.length,
      durationSec: src?.durationSec ?? 0,
      intensity: src?.intensity ?? 'relaxed',
    };
    await db.cardioEntries.add(row);
    return row;
  });
}

export async function updateEntry(id: string, patch: CardioPatch): Promise<void> {
  // An entry with no duration can't count as done.
  await db.cardioEntries.update(
    id,
    patch.durationSec === 0 ? { ...patch, completedAt: undefined } : patch,
  );
}

export async function setEntryDone(
  id: string,
  done: boolean,
  patch: CardioPatch = {},
): Promise<void> {
  await db.transaction('rw', db.cardioEntries, async () => {
    const row = await db.cardioEntries.get(id);
    if (!row) return;
    const duration = patch.durationSec ?? row.durationSec;
    const markDone = done && duration > 0;
    await db.cardioEntries.update(id, { ...patch, completedAt: markDone ? Date.now() : undefined });
  });
}

export async function deleteEntry(id: string): Promise<void> {
  await db.transaction('rw', db.cardioEntries, async () => {
    const e = await db.cardioEntries.get(id);
    if (!e) return;
    await db.cardioEntries.delete(id);
    await renumber(e.sessionExerciseId);
  });
}

/** One item per session with counted entries, newest first. */
export async function getCardioHistory(
  exerciseId: string,
  limit = 10,
): Promise<CardioHistoryItem[]> {
  const exercise =
    (await db.exercises.get(exerciseId)) ?? (await db.customExercises.get(exerciseId));
  const profile = exercise?.cardioProfile;
  const ses = await db.sessionExercises.where('exerciseId').equals(exerciseId).toArray();
  const items: CardioHistoryItem[] = [];
  for (const se of ses) {
    const session = await db.sessions.get(se.sessionId);
    if (!session) continue;
    const counted = (await orderedEntries(se.id)).filter(isCountedEntry);
    if (counted.length === 0) continue;
    const longest = counted.reduce((a, b) => (b.durationSec > a.durationSec ? b : a));
    let km: number | undefined;
    for (const e of counted) {
      const d = estimateDistanceKm(profile, e.intensity, e.durationSec);
      if (d !== undefined) km = (km ?? 0) + d;
    }
    items.push({
      sessionId: session.id,
      startedAt: session.startedAt,
      minutes: counted.reduce((sum, e) => sum + e.durationSec / 60, 0),
      intensity: longest.intensity,
      ...(km !== undefined ? { distanceKm: km } : {}),
    });
  }
  items.sort((a, b) => b.startedAt - a.startedAt);
  return items.slice(0, limit);
}
