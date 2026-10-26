import Dexie, { type EntityTable } from 'dexie';
import type { Exercise, ExerciseMuscle, Muscle } from '@/data';
import type {
  CustomExerciseMuscleRow,
  CustomExerciseRow,
  ProgramRow,
  Session,
  SessionExercise,
  SettingRow,
  SetRow,
} from './types';

export class LiftLogDB extends Dexie {
  muscles!: EntityTable<Muscle, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  exerciseMuscles!: Dexie.Table<ExerciseMuscle, [string, string]>;
  sessions!: EntityTable<Session, 'id'>;
  sessionExercises!: EntityTable<SessionExercise, 'id'>;
  sets!: EntityTable<SetRow, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  // v2: user-owned tables, never touched by ensureSeed().
  customExercises!: EntityTable<CustomExerciseRow, 'id'>;
  customExerciseMuscles!: Dexie.Table<CustomExerciseMuscleRow, [string, string]>;
  programs!: EntityTable<ProgramRow, 'id'>;

  constructor(name = 'lift-log') {
    super(name);
    this.version(1).stores({
      muscles: 'id',
      exercises: 'id, equipment',
      exerciseMuscles: '[exerciseId+muscleId], exerciseId, muscleId',
      sessions: 'id, startedAt, finishedAt',
      sessionExercises: 'id, sessionId, exerciseId, [sessionId+order]',
      sets: 'id, sessionExerciseId, completedAt, [sessionExerciseId+order]',
      settings: 'key',
    });
    // v2 only adds tables; existing v1 data is kept as is.
    this.version(2).stores({
      customExercises: 'id, deletedAt',
      customExerciseMuscles: '[exerciseId+muscleId], exerciseId, muscleId',
      programs: 'id, updatedAt',
    });
  }
}

/** Single app-wide database. Only src/db/** may import this. */
export const db = new LiftLogDB();

export const newId = (): string => crypto.randomUUID();
