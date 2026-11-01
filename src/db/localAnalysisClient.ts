import type { AnalysisInput } from '@/analysis';
import { resolveTargets } from '@/analysis';
import { db } from './db';
import { loadMergedExercises } from './customExercisesRepo';
import { getActiveProgram } from './programsRepo';
import {
  getDeloadDismissals,
  getEquipment,
  getProgramBlocks,
  getTargetOverrides,
  getUnit,
  getWeekStartsOn,
} from './settingsRepo';

/** Reads everything the pure engines need in one consistent snapshot. */
export async function loadTrainingData(): Promise<AnalysisInput['data']> {
  return db.transaction(
    'r',
    [
      db.sessions,
      db.sessionExercises,
      db.sets,
      db.cardioEntries,
      db.exercises,
      db.exerciseMuscles,
      db.customExercises,
      db.customExerciseMuscles,
    ],
    async () => {
      // Tombstoned customs are included so logged history still counts toward volume.
      const [sessions, sessionExercises, sets, cardioEntries, merged] = await Promise.all([
        db.sessions.toArray(),
        db.sessionExercises.toArray(),
        db.sets.toArray(),
        db.cardioEntries.toArray(),
        loadMergedExercises(true),
      ]);
      return { sessions, sessionExercises, sets, cardioEntries, ...merged };
    },
  );
}

/** Everything the analysis queries need, read in one consistent transaction. */
export async function loadAnalysisInput(now: number = Date.now()): Promise<AnalysisInput> {
  return db.transaction(
    'r',
    [
      db.sessions,
      db.sessionExercises,
      db.sets,
      db.cardioEntries,
      db.exercises,
      db.exerciseMuscles,
      db.customExercises,
      db.customExerciseMuscles,
      db.settings,
      db.programs,
    ],
    async () => {
      const [
        data,
        weekStartsOn,
        overrides,
        equipment,
        unit,
        active,
        blocks,
        deloadDismissals,
      ] = await Promise.all([
        loadTrainingData(),
        getWeekStartsOn(),
        getTargetOverrides(),
        getEquipment(),
        getUnit(),
        getActiveProgram(),
        getProgramBlocks(),
        getDeloadDismissals(),
      ]);
      return {
        data,
        settings: { weekStartsOn, targets: resolveTargets(overrides), equipment, unit },
        program: { active, blocks },
        deloadDismissals,
        now,
      };
    },
  );
}
