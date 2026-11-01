import type {
  AlternativeScore,
  AnalysisClient,
  AnalysisInput,
  DeloadSignal,
  E1rmPoint,
} from '@/analysis';
import type {
  AnalysisView,
  AnalyzeView,
  ExerciseDeloadHint,
  ExerciseInsight,
  LongTrend,
  PlanVsActualView,
} from '@/analysis';
import {
  alternatives,
  analysis,
  analyzeView,
  deloadSignal,
  e1rmHistory,
  exerciseDeloadHint,
  exerciseInsight,
  longTrendView,
  planVsActual,
  resolveTargets,
} from '@/analysis';
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
      const [data, weekStartsOn, overrides, equipment, unit, active, blocks, deloadDismissals] =
        await Promise.all([
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

/** Runs every analysis query against the local Dexie database. */
export class LocalAnalysisClient implements AnalysisClient {
  async getAnalyzeView(refTs: number): Promise<AnalyzeView> {
    return analyzeView(await loadAnalysisInput(), refTs);
  }

  async getAnalysis(refTs: number): Promise<AnalysisView> {
    return analysis(await loadAnalysisInput(), refTs);
  }

  /** `excludeSessionId` (the session being logged) is left out of the history. */
  async getExerciseInsight(
    exerciseId: string,
    excludeSessionId?: string,
  ): Promise<ExerciseInsight | null> {
    return exerciseInsight(await loadAnalysisInput(), exerciseId, excludeSessionId);
  }

  async getAlternatives(exerciseId: string, now?: number): Promise<AlternativeScore[]> {
    return alternatives(await loadAnalysisInput(now), exerciseId);
  }

  async getDeloadSignal(now?: number): Promise<DeloadSignal | null> {
    return deloadSignal(await loadAnalysisInput(now));
  }

  async getExerciseDeloadHint(
    exerciseId: string,
    now?: number,
  ): Promise<ExerciseDeloadHint | null> {
    return exerciseDeloadHint(await loadAnalysisInput(now), exerciseId);
  }

  async getLongTrend(refTs: number = Date.now()): Promise<LongTrend> {
    return longTrendView(await loadAnalysisInput(), refTs);
  }

  async getE1rmHistory(exerciseId: string): Promise<E1rmPoint[]> {
    return e1rmHistory(await loadAnalysisInput(), exerciseId);
  }

  async getPlanVsActual(refTs: number, now?: number): Promise<PlanVsActualView | null> {
    return planVsActual(await loadAnalysisInput(now), refTs);
  }
}

export const analysisClient: AnalysisClient = new LocalAnalysisClient();
