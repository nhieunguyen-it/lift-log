import { exerciseMuscles as seedExerciseMuscles } from '@/data';
import type { MuscleId } from '@/data';
import { TRAINING } from '@/config/training';
import { analyze, defaultAnalyzerOptions, exerciseStats } from '../engine';
import { alternatives as scoreAlternatives, nextTarget } from '../recommend';
import type { AlternativeScore } from '../recommend';
import type { AnalysisInput, ExerciseInsight } from '../types';

function primaryMuscles(exerciseId: string, data: AnalysisInput['data']): MuscleId[] {
  const rows = data.exerciseMuscles.length > 0 ? data.exerciseMuscles : seedExerciseMuscles;
  return rows.filter((r) => r.exerciseId === exerciseId && r.weight === 1).map((r) => r.muscleId);
}

/**
 * Stats and next-session target for one exercise. `excludeSessionId` (the session being
 * logged) is left out of the history so the target is based on previous sessions.
 */
export function exerciseInsight(
  input: AnalysisInput,
  exerciseId: string,
  excludeSessionId?: string,
): ExerciseInsight | null {
  const { data, settings } = input;
  const exercise = data.exercises.find((e) => e.id === exerciseId);
  if (!exercise) return null;
  const stats = exerciseStats(data, exerciseId);
  const history = stats.history.filter((h) => h.sessionId !== excludeSessionId);
  const target = nextTarget({
    exercise,
    primaryMuscleIds: primaryMuscles(exerciseId, data),
    history,
    unit: settings.unit,
    exercises: data.exercises,
  });
  return { stats: { ...stats, history, lastSession: history[0] }, target };
}

/** Top alternatives for an exercise, given the user's equipment and this week's exercises. */
export function alternatives(input: AnalysisInput, exerciseId: string): AlternativeScore[] {
  const { data, settings, now } = input;
  const week = analyze(
    data,
    now,
    defaultAnalyzerOptions({ weekStartsOn: settings.weekStartsOn, trendWeeks: 0 }),
  ).current;
  return scoreAlternatives({
    exerciseId,
    availableEquipment: settings.equipment,
    exercisesDoneThisWeek: week.exercisesDone,
    exercises: data.exercises,
    exerciseMuscles: data.exerciseMuscles,
    config: TRAINING,
  });
}
