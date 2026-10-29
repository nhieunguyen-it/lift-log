import { z } from 'zod';
import type { WeightUnit } from '@/lib/units';
import { db, getBoundProfileName } from './db';
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
import { EQUIPMENT, MuscleIdSchema } from '@/data/schema';
import { CUSTOM_ID_PREFIX } from '@/data/merged';
import {
  DeloadDismissalsSchema,
  ProgramBlocksSchema,
  getActiveProgramId,
  getAnalyzeGrouping,
  getProgramBlocks,
  setAnalyzeGrouping,
  setProgramBlocks,
  getDeloadDismissals,
  setActiveProgramId,
  setDeloadDismissals,
  setFlag,
} from './settingsRepo';

/**
 * v2 adds optional phase-2 settings; v3 adds programs, custom exercises and deload
 * dismissals; v4 adds program blocks, the Analyze grouping and session program tags;
 * v5 adds the optional exporting profile's name and optional session `pausedMs`/`pausedAt`
 * timer fields. v1-v4 files still import (missing sections are left untouched).
 */
export const BACKUP_VERSION = 5;

const SessionSchema = z.object({
  id: z.string().min(1),
  startedAt: z.number(),
  finishedAt: z.number().optional(),
  notes: z.string().optional(),
  programId: z.string().min(1).optional(),
  programDayId: z.string().min(1).optional(),
  blockWeek: z.number().int().min(1).optional(),
  // v5: workout timer pause state (absent in older files).
  pausedMs: z.number().min(0).optional(),
  pausedAt: z.number().optional(),
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

const RepRangeSchema = z
  .object({ min: z.number().int().min(1), max: z.number().int().min(1) })
  .refine((r) => r.min <= r.max, { message: 'min must be <= max' });

export const CustomExerciseSchema = z.object({
  id: z.string().startsWith(CUSTOM_ID_PREFIX),
  name: z.string().min(1),
  equipment: z.enum(EQUIPMENT),
  force: z.enum(['push', 'pull', 'static', 'legs']),
  mechanic: z.enum(['compound', 'isolation']),
  isBodyweight: z.boolean(),
  level: z.enum(['beginner', 'intermediate', 'expert']),
  aliases: z.array(z.string()),
  source: z.string(),
  images: z.array(z.string()),
  isCustom: z.literal(true),
  repRange: RepRangeSchema.optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().optional(),
});

export const CustomExerciseMuscleSchema = z.object({
  exerciseId: z.string().startsWith(CUSTOM_ID_PREFIX),
  muscleId: MuscleIdSchema,
  weight: z.number().min(0.25).max(1),
});

export const ProgramSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  // Built-ins live in code; a file can't add read-only templates.
  builtIn: z.literal(false),
  days: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      exercises: z.array(
        z.object({
          exerciseId: z.string().min(1),
          targetSets: z.number().int().min(1),
          repRange: RepRangeSchema.optional(),
        }),
      ),
    }),
  ),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const BackupSchema = z.object({
  app: z.literal('lift-log'),
  version: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(BACKUP_VERSION),
  ]),
  exportedAt: z.number(),
  // v5: name of the profile that was exported; only used as the default name when importing
  // into a new profile. Ignored when importing into the current profile.
  profile: z.object({ name: z.string().min(1) }).optional(),
  settings: z.object({
    unit: z.enum(['kg', 'lbs']),
    weekStartsOn: z.number().int().min(0).max(6).optional(),
    targetOverrides: TargetOverridesSchema.optional(),
    equipment: EquipmentListSchema.optional(),
    activeProgramId: z.string().nullable().optional(),
    deloadDismissals: DeloadDismissalsSchema.optional(),
    // v4
    programBlocks: ProgramBlocksSchema.optional(),
    analyzeGrouping: z.enum(['muscle', 'group']).optional(),
  }),
  sessions: z.array(SessionSchema),
  sessionExercises: z.array(SessionExerciseSchema),
  sets: z.array(SetSchema),
  // v3 sections (absent in v1/v2 files).
  programs: z.array(ProgramSchema).optional(),
  customExercises: z.array(CustomExerciseSchema).optional(),
  customExerciseMuscles: z.array(CustomExerciseMuscleSchema).optional(),
});

export type Backup = z.infer<typeof BackupSchema>;

export async function exportData(now = Date.now()): Promise<Backup> {
  // One read transaction so the snapshot is internally consistent.
  const [
    sessions,
    sessionExercises,
    sets,
    unit,
    weekStartsOn,
    targetOverrides,
    equipment,
    activeProgramId,
    deloadDismissals,
    programs,
    customExercises,
    customExerciseMuscles,
    programBlocks,
    analyzeGrouping,
  ] = await db.transaction('r', USER_TABLES(), () =>
    Promise.all([
      db.sessions.toArray(),
      db.sessionExercises.toArray(),
      db.sets.toArray(),
      getUnit(),
      getWeekStartsOn(),
      getTargetOverrides(),
      getEquipment(),
      getActiveProgramId(),
      getDeloadDismissals(),
      db.programs.toArray(),
      db.customExercises.toArray(),
      db.customExerciseMuscles.toArray(),
      getProgramBlocks(),
      getAnalyzeGrouping(),
    ]),
  );
  return {
    app: 'lift-log',
    version: BACKUP_VERSION,
    exportedAt: now,
    profile: getBoundProfileName() ? { name: getBoundProfileName()! } : undefined,
    settings: {
      unit,
      weekStartsOn,
      targetOverrides,
      equipment,
      activeProgramId,
      deloadDismissals,
      programBlocks,
      analyzeGrouping,
    },
    sessions,
    sessionExercises,
    sets,
    programs: programs.filter((p) => !p.builtIn).map((p) => ({ ...p, builtIn: false as const })),
    customExercises,
    customExerciseMuscles,
  };
}

const USER_TABLES = () => [
  db.sessions,
  db.sessionExercises,
  db.sets,
  db.settings,
  db.programs,
  db.customExercises,
  db.customExerciseMuscles,
];

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
  const dup = (ids: string[]) => new Set(ids).size !== ids.length;
  if (
    dup(d.sessions.map((s) => s.id)) ||
    dup(d.sessionExercises.map((s) => s.id)) ||
    dup(d.sets.map((s) => s.id)) ||
    dup((d.programs ?? []).map((p) => p.id)) ||
    dup((d.customExercises ?? []).map((c) => c.id))
  ) {
    return { ok: false, error: 'Invalid backup: duplicate ids.' };
  }
  const customIds = new Set((d.customExercises ?? []).map((c) => c.id));
  if ((d.customExerciseMuscles ?? []).some((l) => !customIds.has(l.exerciseId))) {
    return { ok: false, error: 'Invalid backup: muscle link references unknown custom exercise.' };
  }
  return { ok: true, data: d };
}

/**
 * Replaces all user data (sessions, exercises-in-session, sets) and the settings
 * present in the file. Settings missing from older (v1) files are left as they are.
 */
export async function importData(data: Backup): Promise<void> {
  const valid = BackupSchema.parse(data);
  await db.transaction('rw', USER_TABLES(), async () => {
    await Promise.all([db.sessions.clear(), db.sessionExercises.clear(), db.sets.clear()]);
    await db.sessions.bulkAdd(valid.sessions);
    await db.sessionExercises.bulkAdd(valid.sessionExercises);
    await db.sets.bulkAdd(valid.sets);
    const st = valid.settings;
    await setUnit(st.unit as WeightUnit);
    if (st.weekStartsOn !== undefined) await setWeekStartsOn(st.weekStartsOn as WeekStartDay);
    if (st.targetOverrides !== undefined) await setTargetOverrides(st.targetOverrides);
    if (st.equipment !== undefined) await setEquipment(st.equipment);
    if (valid.sessions.length > 0) {
      // Restoring history makes this an existing user: no onboarding / what's-new prompts.
      await setFlag('onboardingDone', true);
      await setFlag('whatsNewPhase3Seen', true);
      await setFlag('whatsNewPhase4Seen', true);
      await setFlag('whatsNewPhase5Seen', true);
    }
    if (st.activeProgramId !== undefined) await setActiveProgramId(st.activeProgramId);
    if (st.deloadDismissals !== undefined) await setDeloadDismissals(st.deloadDismissals);
    if (st.programBlocks !== undefined) await setProgramBlocks(st.programBlocks);
    if (st.analyzeGrouping !== undefined) await setAnalyzeGrouping(st.analyzeGrouping);
    if (valid.programs !== undefined) {
      await db.programs.clear();
      await db.programs.bulkAdd(valid.programs);
    }
    if (valid.customExercises !== undefined) {
      await Promise.all([db.customExercises.clear(), db.customExerciseMuscles.clear()]);
      await db.customExercises.bulkAdd(valid.customExercises);
      await db.customExerciseMuscles.bulkAdd(valid.customExerciseMuscles ?? []);
    }
  });
}

/** Encrypted backup file (M11 implements encrypt/decrypt with WebCrypto). Self-describing. */
export interface EncryptedBackupEnvelope {
  app: 'lift-log';
  format: 'lift-log-encrypted';
  version: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string /* base64 */ };
  cipher: { name: 'AES-GCM'; iv: string /* base64 */ };
  /** base64 AES-GCM ciphertext of the plain backup JSON. */
  data: string;
}
