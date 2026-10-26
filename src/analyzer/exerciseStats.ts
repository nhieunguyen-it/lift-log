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
