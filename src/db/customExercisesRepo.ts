import { z } from 'zod';
import type { ExerciseMuscle } from '@/data';
import { CUSTOM_ID_PREFIX, DELETED_EXERCISE_NAME, type MergedExercise } from '@/data/merged';
import { EQUIPMENT, ExerciseMuscleSchema } from '@/data/schema';
import { db } from './db';
import type { CustomExerciseRow } from './types';

/** Seed + custom exercises and links. `includeDeleted` keeps tombstones (for history/name lookup). */
export async function loadMergedExercises(
  includeDeleted = false,
): Promise<{ exercises: MergedExercise[]; exerciseMuscles: ExerciseMuscle[] }> {
  const [seed, links, custom, customLinks] = await Promise.all([
    db.exercises.toArray(),
    db.exerciseMuscles.toArray(),
    db.customExercises.toArray(),
    db.customExerciseMuscles.toArray(),
  ]);
  const kept = includeDeleted ? custom : custom.filter((c) => c.deletedAt === undefined);
  const keptIds = new Set(kept.map((c) => c.id));
  return {
    exercises: [...seed, ...kept],
    exerciseMuscles: [...links, ...customLinks.filter((l) => keptIds.has(l.exerciseId))],
  };
}

// ---------------------------------------------------------------------------
// Custom exercise CRUD
// ---------------------------------------------------------------------------

const RepRangeInputSchema = z
  .object({ min: z.number().int().min(1), max: z.number().int().min(1) })
  .refine((r) => r.min <= r.max, { message: 'Min reps must be <= max reps', path: ['max'] });

const MuscleLinkInputSchema = ExerciseMuscleSchema.omit({ exerciseId: true });

export const CustomExerciseInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
    equipment: z.enum(EQUIPMENT),
    force: z.enum(['push', 'pull', 'static', 'legs']),
    mechanic: z.enum(['compound', 'isolation']),
    isBodyweight: z.boolean(),
    repRange: RepRangeInputSchema.optional(),
    muscles: z.array(MuscleLinkInputSchema).min(1, 'Pick at least one muscle'),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    for (const m of v.muscles) {
      if (seen.has(m.muscleId)) {
        ctx.addIssue({ code: 'custom', path: ['muscles'], message: 'Duplicate muscle' });
        break;
      }
      seen.add(m.muscleId);
    }
    const primaries = v.muscles.filter((m) => m.weight === 1).length;
    if (primaries !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['muscles'],
        message: 'Exactly one primary muscle (100%) is required',
      });
    }
  });

export type CustomExerciseInput = z.infer<typeof CustomExerciseInputSchema>;

export class CustomExerciseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomExerciseValidationError';
  }
}

/** Returns parsed input or throws CustomExerciseValidationError with the first problem. */
export function parseCustomExerciseInput(input: unknown): CustomExerciseInput {
  const res = CustomExerciseInputSchema.safeParse(input);
  if (!res.success) throw new CustomExerciseValidationError(res.error.issues[0].message);
  return res.data;
}

export async function createCustomExercise(input: CustomExerciseInput): Promise<string> {
  const v = parseCustomExerciseInput(input);
  const id = `${CUSTOM_ID_PREFIX}${crypto.randomUUID()}`;
  const now = Date.now();
  const row: CustomExerciseRow = {
    id,
    name: v.name,
    equipment: v.equipment,
    force: v.force,
    mechanic: v.mechanic,
    isBodyweight: v.isBodyweight,
    level: 'beginner',
    aliases: [],
    source: 'custom',
    images: [],
    isCustom: true,
    ...(v.repRange ? { repRange: v.repRange } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction('rw', db.customExercises, db.customExerciseMuscles, async () => {
    await db.customExercises.add(row);
    await db.customExerciseMuscles.bulkAdd(v.muscles.map((m) => ({ ...m, exerciseId: id })));
  });
  return id;
}

export async function updateCustomExercise(id: string, input: CustomExerciseInput): Promise<void> {
  const v = parseCustomExerciseInput(input);
  await db.transaction('rw', db.customExercises, db.customExerciseMuscles, async () => {
    const existing = await db.customExercises.get(id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error('Custom exercise not found.');
    }
    const { repRange: _old, ...rest } = existing;
    void _old;
    await db.customExercises.put({
      ...rest,
      name: v.name,
      equipment: v.equipment,
      force: v.force,
      mechanic: v.mechanic,
      isBodyweight: v.isBodyweight,
      ...(v.repRange ? { repRange: v.repRange } : {}),
      updatedAt: Date.now(),
    });
    await db.customExerciseMuscles.where('exerciseId').equals(id).delete();
    await db.customExerciseMuscles.bulkAdd(v.muscles.map((m) => ({ ...m, exerciseId: id })));
  });
}

/** Number of logged sets (any session) recorded against this exercise. */
export async function countLoggedSets(exerciseId: string): Promise<number> {
  const ses = await db.sessionExercises.where('exerciseId').equals(exerciseId).toArray();
  if (ses.length === 0) return 0;
  const counts = await Promise.all(
    ses.map((se) => db.sets.where('sessionExerciseId').equals(se.id).count()),
  );
  return counts.reduce((a, b) => a + b, 0);
}

/** True if any session references the exercise (even with no sets). */
export async function hasHistory(exerciseId: string): Promise<boolean> {
  return (await db.sessionExercises.where('exerciseId').equals(exerciseId).count()) > 0;
}

/**
 * Deletes a custom exercise. With history it becomes a tombstone (soft delete: row and
 * muscle links stay so history remains readable and counted); otherwise row and links go.
 */
export async function deleteCustomExercise(id: string): Promise<'soft' | 'hard'> {
  return db.transaction(
    'rw',
    [db.customExercises, db.customExerciseMuscles, db.sessionExercises],
    async () => {
      const existing = await db.customExercises.get(id);
      if (!existing) throw new Error('Custom exercise not found.');
      if ((await db.sessionExercises.where('exerciseId').equals(id).count()) > 0) {
        if (existing.deletedAt === undefined) {
          await db.customExercises.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
        }
        return 'soft' as const;
      }
      await db.customExerciseMuscles.where('exerciseId').equals(id).delete();
      await db.customExercises.delete(id);
      return 'hard' as const;
    },
  );
}

/** Display name for any exercise id, including tombstones; unknown ids resolve to a placeholder. */
export async function resolveExerciseNames(ids: string[]): Promise<Map<string, string>> {
  const { exercises } = await loadMergedExercises(true);
  const byId = new Map(exercises.map((e) => [e.id, e.name]));
  return new Map(ids.map((id) => [id, byId.get(id) ?? DELETED_EXERCISE_NAME]));
}
