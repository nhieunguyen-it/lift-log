import { exerciseMuscles, exercises } from '@/data';
import type { Session, SessionExercise, SetRow } from '@/db/types';
import type { TrainingData } from './types';

const DAY = 86_400_000;

/** Deterministic PRNG (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SetSpec {
  weightKg?: number;
  reps?: number;
  rir?: number;
  isWarmup?: boolean;
  /** Defaults to completed (startedAt + 1 min). Pass null for an uncompleted set. */
  completedAt?: number | null;
}

export interface ExerciseSpec {
  exerciseId: string;
  sets: SetSpec[];
}

export interface SessionParts {
  sessions: Session[];
  sessionExercises: SessionExercise[];
  sets: SetRow[];
}

/** Build one session with its exercises and sets. */
export function makeSession(id: string, startedAt: number, specs: ExerciseSpec[]): SessionParts {
  const sessionExercises: SessionExercise[] = [];
  const sets: SetRow[] = [];
  specs.forEach((spec, ei) => {
    const seId = `${id}-e${ei}`;
    sessionExercises.push({ id: seId, sessionId: id, exerciseId: spec.exerciseId, order: ei });
    spec.sets.forEach((s, si) => {
      const row: SetRow = {
        id: `${seId}-s${si}`,
        sessionExerciseId: seId,
        order: si,
        weightKg: s.weightKg,
        reps: s.reps ?? 8,
        rir: s.rir,
        isWarmup: s.isWarmup ?? false,
      };
      if (s.completedAt !== null) row.completedAt = s.completedAt ?? startedAt + 60_000 * (si + 1);
      sets.push(row);
    });
  });
  return {
    sessions: [{ id, startedAt, finishedAt: startedAt + 3_600_000 }],
    sessionExercises,
    sets,
  };
}

/** Combine session parts into TrainingData using the real seed catalog. */
export function makeData(...parts: SessionParts[]): TrainingData {
  return {
    sessions: parts.flatMap((p) => p.sessions),
    sessionExercises: parts.flatMap((p) => p.sessionExercises),
    sets: parts.flatMap((p) => p.sets),
    exercises,
    exerciseMuscles,
  };
}

export interface GenerateOptions {
  weeks: number;
  sessionsPerWeek: number;
  startTs: number;
  seed: number;
}

export function generateTrainingData(opts: GenerateOptions): TrainingData {
  const rng = createRng(opts.seed);
  const withMuscles = new Set(exerciseMuscles.map((m) => m.exerciseId));
  const pool = exercises.filter((e) => withMuscles.has(e.id));
  const pick = (n: number) => Math.floor(rng() * n);
  const parts: SessionParts[] = [];
  for (let w = 0; w < opts.weeks; w++) {
    for (let s = 0; s < opts.sessionsPerWeek; s++) {
      const day = Math.min(6, Math.floor((s * 7) / opts.sessionsPerWeek));
      const startedAt = opts.startTs + (w * 7 + day) * DAY + (17 + pick(3)) * 3_600_000;
      const specs: ExerciseSpec[] = [];
      const count = 3 + pick(3);
      const used = new Set<string>();
      for (let i = 0; i < count; i++) {
        const ex = pool[pick(pool.length)];
        if (used.has(ex.id)) continue;
        used.add(ex.id);
        const base = ex.isBodyweight ? 0 : 20 + pick(80);
        const sets: SetSpec[] = [];
        if (!ex.isBodyweight && rng() < 0.3) {
          sets.push({ weightKg: Math.round(base / 2), reps: 10, isWarmup: true });
        }
        const working = 3 + pick(2);
        for (let k = 0; k < working; k++) {
          const r = rng();
          sets.push({
            weightKg: base > 0 ? base : undefined,
            reps: 5 + pick(11),
            rir: r < 0.2 ? undefined : r < 0.35 ? 5 + pick(3) : pick(4),
          });
        }
        specs.push({ exerciseId: ex.id, sets });
      }
      parts.push(makeSession(`w${w}s${s}`, startedAt, specs));
    }
  }
  return makeData(...parts);
}
