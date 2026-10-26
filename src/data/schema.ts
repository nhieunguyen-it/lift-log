import { z } from 'zod';
import { MUSCLE_IDS } from './muscles';

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
] as const;

export const MuscleIdSchema = z.enum(MUSCLE_IDS);

export const MuscleSchema = z.object({
  id: MuscleIdSchema,
  name: z.string().min(1),
  group: z.enum(['push', 'pull', 'legs', 'core']).optional(),
});

export const ExerciseSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be a kebab-case slug'),
  name: z.string().min(1),
  equipment: z.enum(EQUIPMENT),
  force: z.enum(['push', 'pull', 'static', 'legs']),
  mechanic: z.enum(['compound', 'isolation']),
  isBodyweight: z.boolean(),
  level: z.enum(['beginner', 'intermediate', 'expert']),
  aliases: z.array(z.string().min(1)),
  source: z.string().min(1),
});

export const ExerciseMuscleSchema = z.object({
  exerciseId: z.string().min(1),
  muscleId: MuscleIdSchema,
  weight: z.number().min(0.25).max(1),
});

export type MuscleParsed = z.infer<typeof MuscleSchema>;
export type ExerciseParsed = z.infer<typeof ExerciseSchema>;
export type ExerciseMuscleParsed = z.infer<typeof ExerciseMuscleSchema>;

export interface SeedInput {
  muscles: unknown;
  exercises: unknown;
  exerciseMuscles: unknown;
}

export interface SeedData {
  muscles: MuscleParsed[];
  exercises: ExerciseParsed[];
  exerciseMuscles: ExerciseMuscleParsed[];
}

const MIN_MUSCLE_COVERAGE = 2;

/**
 * Parses and cross-validates the seed data. Throws an Error listing every
 * violation (unique IDs, valid references, weight range, 1.0 primary per
 * exercise, per-muscle coverage, no duplicate links).
 */
export function validateSeed(input: SeedInput): SeedData {
  const muscles = z.array(MuscleSchema).parse(input.muscles);
  const exercises = z.array(ExerciseSchema).parse(input.exercises);
  const exerciseMuscles = z.array(ExerciseMuscleSchema).parse(input.exerciseMuscles);
  const problems: string[] = [];

  const muscleIds = new Set<string>();
  for (const m of muscles) {
    if (muscleIds.has(m.id)) problems.push(`duplicate muscle id: ${m.id}`);
    muscleIds.add(m.id);
  }
  for (const id of MUSCLE_IDS) {
    if (!muscleIds.has(id)) problems.push(`missing muscle: ${id}`);
  }

  const exerciseIds = new Set<string>();
  for (const e of exercises) {
    if (exerciseIds.has(e.id)) problems.push(`duplicate exercise id: ${e.id}`);
    exerciseIds.add(e.id);
  }

  const pairs = new Set<string>();
  const hasPrimary = new Set<string>();
  const coverage = new Map<string, Set<string>>();
  for (const l of exerciseMuscles) {
    if (!exerciseIds.has(l.exerciseId)) {
      problems.push(`exerciseMuscle references unknown exercise: ${l.exerciseId}`);
    }
    if (!muscleIds.has(l.muscleId)) {
      problems.push(`exerciseMuscle references unknown muscle: ${l.muscleId}`);
    }
    const key = `${l.exerciseId}::${l.muscleId}`;
    if (pairs.has(key)) problems.push(`duplicate exerciseMuscle: ${key}`);
    pairs.add(key);
    if (l.weight === 1) hasPrimary.add(l.exerciseId);
    const set = coverage.get(l.muscleId) ?? new Set<string>();
    set.add(l.exerciseId);
    coverage.set(l.muscleId, set);
  }

  for (const e of exercises) {
    if (!hasPrimary.has(e.id)) problems.push(`exercise has no 1.0 primary muscle: ${e.id}`);
  }
  for (const id of MUSCLE_IDS) {
    const n = coverage.get(id)?.size ?? 0;
    if (n < MIN_MUSCLE_COVERAGE) {
      problems.push(`muscle ${id} covered by ${n} exercise(s), need >= ${MIN_MUSCLE_COVERAGE}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid seed data:\n- ${problems.join('\n- ')}`);
  }
  return { muscles, exercises, exerciseMuscles };
}
