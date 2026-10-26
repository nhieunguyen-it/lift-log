import exercisesJson from './exercises.json';
import exerciseMusclesJson from './exerciseMuscles.json';
import { MUSCLES } from './muscles';
import { validateSeed } from './schema';
import type { ExerciseMuscleParsed, ExerciseParsed, MuscleParsed } from './schema';

/** Bump when seed data changes so the app can re-seed/migrate local DBs. */
export const SEED_VERSION = 1;

export type Muscle = MuscleParsed;
export type Exercise = ExerciseParsed;
export type ExerciseMuscle = ExerciseMuscleParsed;
export type Equipment = Exercise['equipment'];

const seed = validateSeed({
  muscles: MUSCLES,
  exercises: exercisesJson,
  exerciseMuscles: exerciseMusclesJson,
});

export const muscles: Muscle[] = seed.muscles;
export const exercises: Exercise[] = seed.exercises;
export const exerciseMuscles: ExerciseMuscle[] = seed.exerciseMuscles;

export { MUSCLE_IDS, MUSCLES } from './muscles';
export type { MuscleId } from './muscles';
export { validateSeed } from './schema';
