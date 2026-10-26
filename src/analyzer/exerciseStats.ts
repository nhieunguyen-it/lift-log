import type { ExerciseSessionSets, ExerciseStats, LoggedSet, TrainingData } from './types';

export function epley1Rm(weightKg: number, reps: number): number {
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function exerciseStats(data: TrainingData, exerciseId: string): ExerciseStats {
  const sessionStart = new Map<string, number>();
  for (const s of data.sessions) sessionStart.set(s.id, s.startedAt);
  const seToSession = new Map<string, string>();
  for (const se of data.sessionExercises) {
    if (se.exerciseId === exerciseId) seToSession.set(se.id, se.sessionId);
  }
  const bySession = new Map<string, { order: number; set: (typeof data.sets)[number] }[]>();
  const seOrder = new Map<string, number>();
  for (const se of data.sessionExercises) {
    if (se.exerciseId === exerciseId) seOrder.set(se.id, se.order);
  }
  for (const set of data.sets) {
    if (set.completedAt === undefined || set.isWarmup) continue;
    const sessionId = seToSession.get(set.sessionExerciseId);
    if (sessionId === undefined) continue;
    const list = bySession.get(sessionId) ?? [];
    list.push({ order: (seOrder.get(set.sessionExerciseId) ?? 0) * 1e6 + set.order, set });
    bySession.set(sessionId, list);
  }

  const history: ExerciseSessionSets[] = [];
  for (const [sessionId, rows] of bySession) {
    const startedAt = sessionStart.get(sessionId);
    if (startedAt === undefined) continue;
    rows.sort((a, b) => a.order - b.order);
    history.push({
      sessionId,
      startedAt,
      sets: rows.map(({ set }) => ({ weightKg: set.weightKg, reps: set.reps, rir: set.rir })),
    });
  }
  history.sort((a, b) => b.startedAt - a.startedAt);

  let best: LoggedSet | undefined;
  let bestE1: number | undefined;
  let bestReps: LoggedSet | undefined;
  for (const h of history) {
    for (const s of h.sets) {
      if (s.weightKg !== undefined && s.weightKg > 0) {
        const e = epley1Rm(s.weightKg, s.reps);
        if (bestE1 === undefined || e > bestE1) {
          bestE1 = e;
          best = s;
        }
      } else if (!bestReps || s.reps > bestReps.reps) {
        bestReps = s;
      }
    }
  }
  return {
    exerciseId,
    bestSet: best ?? bestReps,
    estimated1RmKg: bestE1,
    lastSession: history[0],
    history,
  };
}

/** Best Epley e1RM (kg) among a session's weighted sets; undefined when none are weighted. */
export function sessionE1RmKg(session: ExerciseSessionSets): number | undefined {
  let best: number | undefined;
  for (const s of session.sets) {
    if (s.weightKg === undefined || s.weightKg <= 0) continue;
    const e = epley1Rm(s.weightKg, s.reps);
    if (best === undefined || e > best) best = e;
  }
  return best;
}

/** The set shown as a session's "best": highest e1RM, else most reps. */
export function sessionBestSet(session: ExerciseSessionSets): LoggedSet | undefined {
  let best: LoggedSet | undefined;
  let bestScore = -1;
  for (const s of session.sets) {
    const score =
      s.weightKg !== undefined && s.weightKg > 0 ? epley1Rm(s.weightKg, s.reps) : s.reps / 1e6;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

export interface E1rmPoint {
  sessionId: string;
  startedAt: number;
  e1rmKg: number;
  bestSet: LoggedSet;
}

/** e1RM per session, oldest first. Sessions without weighted sets are skipped. */
export function e1rmSeries(history: ExerciseSessionSets[]): E1rmPoint[] {
  const out: E1rmPoint[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    const e1rmKg = sessionE1RmKg(h);
    const bestSet = sessionBestSet(h);
    if (e1rmKg !== undefined && bestSet) {
      out.push({ sessionId: h.sessionId, startedAt: h.startedAt, e1rmKg, bestSet });
    }
  }
  return out;
}

/**
 * Per-exercise session history (newest first) for every exercise in one pass over the data.
 * Same working-set rules as `exerciseStats` (completed, not warm-up).
 */
export function exerciseHistories(data: TrainingData): Map<string, ExerciseSessionSets[]> {
  const sessionStart = new Map<string, number>();
  for (const s of data.sessions) sessionStart.set(s.id, s.startedAt);
  const seInfo = new Map<string, { sessionId: string; exerciseId: string; order: number }>();
  for (const se of data.sessionExercises) {
    seInfo.set(se.id, { sessionId: se.sessionId, exerciseId: se.exerciseId, order: se.order });
  }
  type Row = { order: number; set: LoggedSet };
  const groups = new Map<string, { exerciseId: string; sessionId: string; rows: Row[] }>();
  for (const set of data.sets) {
    if (set.completedAt === undefined || set.isWarmup) continue;
    const se = seInfo.get(set.sessionExerciseId);
    if (!se) continue;
    const key = `${se.exerciseId}\u0000${se.sessionId}`;
    let g = groups.get(key);
    if (!g) {
      g = { exerciseId: se.exerciseId, sessionId: se.sessionId, rows: [] };
      groups.set(key, g);
    }
    g.rows.push({
      order: se.order * 1e6 + set.order,
      set: { weightKg: set.weightKg, reps: set.reps, rir: set.rir },
    });
  }
  const out = new Map<string, ExerciseSessionSets[]>();
  for (const g of groups.values()) {
    const startedAt = sessionStart.get(g.sessionId);
    if (startedAt === undefined) continue;
    g.rows.sort((a, b) => a.order - b.order);
    const entry = { sessionId: g.sessionId, startedAt, sets: g.rows.map((r) => r.set) };
    const list = out.get(g.exerciseId);
    if (list) list.push(entry);
    else out.set(g.exerciseId, [entry]);
  }
  for (const list of out.values()) list.sort((a, b) => b.startedAt - a.startedAt);
  return out;
}
