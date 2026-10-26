import { z } from 'zod';
import type { WeightUnit } from '@/lib/units';
import { db } from './db';
import {
  EquipmentListSchema,
  TargetOverridesSchema,
  getEquipment,
  getTargetOverrides,
  getUnit,
  getWeekStartsOn,
  setEquipment,
  setTargetOverrides,
  setUnit,
  setWeekStartsOn,
} from './settingsRepo';
import type { WeekStartDay } from '@/analyzer/types';

/** v2 adds optional phase-2 settings; v1 files (phase 1) still import. */
export const BACKUP_VERSION = 2;

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
  version: z.union([z.literal(1), z.literal(BACKUP_VERSION)]),
  exportedAt: z.number(),
  settings: z.object({
    unit: z.enum(['kg', 'lbs']),
    weekStartsOn: z.number().int().min(0).max(6).optional(),
    targetOverrides: TargetOverridesSchema.optional(),
    equipment: EquipmentListSchema.optional(),
  }),
  sessions: z.array(SessionSchema),
  sessionExercises: z.array(SessionExerciseSchema),
  sets: z.array(SetSchema),
});

export type Backup = z.infer<typeof BackupSchema>;

export async function exportData(now = Date.now()): Promise<Backup> {
  // One read transaction so the snapshot is internally consistent.
  const [sessions, sessionExercises, sets, unit, weekStartsOn, targetOverrides, equipment] =
    await db.transaction('r', [db.sessions, db.sessionExercises, db.sets, db.settings], () =>
      Promise.all([
        db.sessions.toArray(),
        db.sessionExercises.toArray(),
        db.sets.toArray(),
        getUnit(),
        getWeekStartsOn(),
        getTargetOverrides(),
        getEquipment(),
      ]),
    );
  return {
    app: 'lift-log',
    version: BACKUP_VERSION,
    exportedAt: now,
    settings: { unit, weekStartsOn, targetOverrides, equipment },
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

/**
 * Replaces all user data (sessions, exercises-in-session, sets) and the settings
 * present in the file. Settings missing from older (v1) files are left as they are.
 */
export async function importData(data: Backup): Promise<void> {
  const valid = BackupSchema.parse(data);
  await db.transaction('rw', [db.sessions, db.sessionExercises, db.sets, db.settings], async () => {
    await Promise.all([db.sessions.clear(), db.sessionExercises.clear(), db.sets.clear()]);
    await db.sessions.bulkAdd(valid.sessions);
    await db.sessionExercises.bulkAdd(valid.sessionExercises);
    await db.sets.bulkAdd(valid.sets);
    const st = valid.settings;
    await setUnit(st.unit as WeightUnit);
    if (st.weekStartsOn !== undefined) await setWeekStartsOn(st.weekStartsOn as WeekStartDay);
    if (st.targetOverrides !== undefined) await setTargetOverrides(st.targetOverrides);
    if (st.equipment !== undefined) await setEquipment(st.equipment);
  });
}
