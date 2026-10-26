import { z } from 'zod';
import type { WeightUnit } from '@/lib/units';
import { db } from './db';
import { getUnit, setUnit } from './settingsRepo';

export const BACKUP_VERSION = 1;

const SessionSchema = z.object({
  id: z.string().min(1),
  startedAt: z.number(),
  finishedAt: z.number().optional(),
  notes: z.string().optional(),
});
const SessionExerciseSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  order: z.number().int(),
});
const SetSchema = z.object({
  id: z.string().min(1),
  sessionExerciseId: z.string().min(1),
  order: z.number().int(),
  weightKg: z.number().min(0).optional(),
  reps: z.number().min(0),
  rir: z.number().min(0).optional(),
  isWarmup: z.boolean(),
  completedAt: z.number().optional(),
});

export const BackupSchema = z.object({
  app: z.literal('lift-log'),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number(),
  settings: z.object({ unit: z.enum(['kg', 'lbs']) }),
  sessions: z.array(SessionSchema),
  sessionExercises: z.array(SessionExerciseSchema),
  sets: z.array(SetSchema),
});

export type Backup = z.infer<typeof BackupSchema>;

export async function exportData(now = Date.now()): Promise<Backup> {
  const [sessions, sessionExercises, sets, unit] = await Promise.all([
    db.sessions.toArray(),
    db.sessionExercises.toArray(),
    db.sets.toArray(),
    getUnit(),
  ]);
  return {
    app: 'lift-log',
    version: BACKUP_VERSION,
    exportedAt: now,
    settings: { unit },
    sessions,
    sessionExercises,
    sets,
  };
}

export type ParseResult = { ok: true; data: Backup } | { ok: false; error: string };

/** Validates untrusted JSON text (shape + referential integrity). */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  const res = BackupSchema.safeParse(raw);
  if (!res.success) {
    const issue = res.error.issues[0];
    return {
      ok: false,
      error: `Invalid backup: ${issue.path.join('.') || 'root'} ${issue.message}`,
    };
  }
  const d = res.data;
  const sIds = new Set(d.sessions.map((s) => s.id));
  const seIds = new Set(d.sessionExercises.map((s) => s.id));
  if (d.sessionExercises.some((se) => !sIds.has(se.sessionId))) {
    return { ok: false, error: 'Invalid backup: exercise references unknown session.' };
  }
  if (d.sets.some((s) => !seIds.has(s.sessionExerciseId))) {
    return { ok: false, error: 'Invalid backup: set references unknown exercise entry.' };
  }
  return { ok: true, data: d };
}

/** Replaces all user data (sessions, exercises-in-session, sets) and the unit. */
export async function importData(data: Backup): Promise<void> {
  const valid = BackupSchema.parse(data);
  await db.transaction('rw', [db.sessions, db.sessionExercises, db.sets, db.settings], async () => {
    await Promise.all([db.sessions.clear(), db.sessionExercises.clear(), db.sets.clear()]);
    await db.sessions.bulkAdd(valid.sessions);
    await db.sessionExercises.bulkAdd(valid.sessionExercises);
    await db.sets.bulkAdd(valid.sets);
    await setUnit(valid.settings.unit as WeightUnit);
  });
}
