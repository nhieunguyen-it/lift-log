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

/**
 * The database of the active profile. Only src/db/** may import this.
 * It is a live binding: `bindDb()` swaps it once at startup (before render) to the active
 * profile's database; it is never swapped under mounted UI (switching profiles reloads the app).
 */
export let db = new LiftLogDB();

let boundProfileName: string | undefined;

/** Points `db` at another profile's database (startup bootstrap, tests, import-into-new-profile). */
export function bindDb(dbName: string, profileName?: string): LiftLogDB {
  if (db.name !== dbName) {
    db.close();
    db = new LiftLogDB(dbName);
  }
  boundProfileName = profileName;
  return db;
}

/** Display name of the profile `db` is bound to (undefined before bootstrap). */
export const getBoundProfileName = (): string | undefined => boundProfileName;

export const newId = (): string => crypto.randomUUID();
