import { exerciseMuscles as seedExerciseMuscles } from '@/data';
import type { MuscleId } from '@/data';
import { analyze, defaultAnalyzerOptions, exerciseStats } from '@/analyzer';
import type { AnalyzerResult, ExerciseStats, TrainingData } from '@/analyzer';
import { TRAINING } from '@/config/training';
import { alternatives, nextTarget, volumeSuggestions } from '@/recommend';
import type { AlternativeScore, ProgressionTarget, VolumeSuggestion } from '@/recommend';
import { db } from './db';
import {
  getEquipment,
  getTargetOverrides,
  getUnit,
  getWeekStartsOn,
  resolveTargets,
} from './settingsRepo';

/** Reads everything the pure engines need in one consistent snapshot. */
export async function loadTrainingData(): Promise<TrainingData> {
  return db.transaction(
    'r',
    [db.sessions, db.sessionExercises, db.sets, db.exercises, db.exerciseMuscles],
    async () => {
      const [sessions, sessionExercises, sets, exercises, exerciseMuscles] = await Promise.all([
        db.sessions.toArray(),
        db.sessionExercises.toArray(),
        db.sets.toArray(),
        db.exercises.toArray(),
        db.exerciseMuscles.toArray(),
      ]);
      return { sessions, sessionExercises, sets, exercises, exerciseMuscles };
    },
  );
}

export interface AnalysisView {
  result: AnalyzerResult;
  suggestions: VolumeSuggestion[];
  /** True when the user has no sessions at all. */
  empty: boolean;
}

/** Analysis of the week containing `refTs`, plus volume suggestions for it. */
export async function getAnalysis(refTs: number): Promise<AnalysisView> {
  const [data, weekStartsOn, overrides, equipment] = await Promise.all([
    loadTrainingData(),
    getWeekStartsOn(),
    getTargetOverrides(),
    getEquipment(),
  ]);
  const result = analyze(
    data,
    refTs,
    defaultAnalyzerOptions({ weekStartsOn, targets: resolveTargets(overrides) }),
  );
  const suggestions = volumeSuggestions({
    week: result.current,
    exercises: data.exercises,
    exerciseMuscles: data.exerciseMuscles,
    availableEquipment: equipment,
  });
  return { result, suggestions, empty: data.sessions.length === 0 };
}

function primaryMuscles(exerciseId: string, data: TrainingData): MuscleId[] {
  const rows = data.exerciseMuscles.length > 0 ? data.exerciseMuscles : seedExerciseMuscles;
  return rows.filter((r) => r.exerciseId === exerciseId && r.weight === 1).map((r) => r.muscleId);
}

/**
 * Stats and next-session target for one exercise. `excludeSessionId` (the session being
 * logged) is left out of the history so the target is based on previous sessions.
 */
export async function getExerciseInsight(
  exerciseId: string,
  excludeSessionId?: string,
): Promise<{ stats: ExerciseStats; target: ProgressionTarget } | null> {
  const [data, unit] = await Promise.all([loadTrainingData(), getUnit()]);
  const exercise = data.exercises.find((e) => e.id === exerciseId);
  if (!exercise) return null;
  const stats = exerciseStats(data, exerciseId);
  const history = stats.history.filter((h) => h.sessionId !== excludeSessionId);
  const target = nextTarget({
    exercise,
    primaryMuscleIds: primaryMuscles(exerciseId, data),
    history,
    unit,
  });
  return { stats: { ...stats, history, lastSession: history[0] }, target };
}

/** Top alternatives for an exercise, given the user's equipment and this week's exercises. */
export async function getAlternatives(
  exerciseId: string,
  now = Date.now(),
): Promise<AlternativeScore[]> {
  const [data, equipment, weekStartsOn] = await Promise.all([
    loadTrainingData(),
    getEquipment(),
    getWeekStartsOn(),
  ]);
  const week = analyze(data, now, defaultAnalyzerOptions({ weekStartsOn, trendWeeks: 0 })).current;
  return alternatives({
    exerciseId,
    availableEquipment: equipment,
    exercisesDoneThisWeek: week.exercisesDone,
    exercises: data.exercises,
    exerciseMuscles: data.exerciseMuscles,
    config: TRAINING,
  });
}
