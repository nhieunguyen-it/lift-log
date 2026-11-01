import { exerciseMuscles as seedExerciseMuscles } from '@/data';
import type { MuscleId } from '@/data';
import { analysis, analyze, defaultAnalyzerOptions, exerciseStats } from '@/analysis';
import type { AnalysisView, ExerciseStats, TrainingData } from '@/analysis';
import { TRAINING } from '@/config/training';
import { alternatives, nextTarget } from '@/analysis';
import type { AlternativeScore, ProgressionTarget } from '@/analysis';
import { loadAnalysisInput, loadTrainingData } from './localAnalysisClient';
import { getEquipment, getUnit, getWeekStartsOn } from './settingsRepo';

export { loadTrainingData };

export type { AnalysisView };

/** Analysis of the week containing `refTs`, plus volume suggestions for it. */
export async function getAnalysis(refTs: number): Promise<AnalysisView> {
  return analysis(await loadAnalysisInput(), refTs);
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
    exercises: data.exercises,
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
