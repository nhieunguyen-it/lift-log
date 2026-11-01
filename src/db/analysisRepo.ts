import { alternatives, analysis, exerciseInsight } from '@/analysis';
import type { AlternativeScore, AnalysisView, ExerciseInsight } from '@/analysis';
import { loadAnalysisInput, loadTrainingData } from './localAnalysisClient';

export { loadTrainingData };

export type { AnalysisView };

/** Analysis of the week containing `refTs`, plus volume suggestions for it. */
export async function getAnalysis(refTs: number): Promise<AnalysisView> {
  return analysis(await loadAnalysisInput(), refTs);
}

/**
 * Stats and next-session target for one exercise. `excludeSessionId` (the session being
 * logged) is left out of the history so the target is based on previous sessions.
 */
export async function getExerciseInsight(
  exerciseId: string,
  excludeSessionId?: string,
): Promise<ExerciseInsight | null> {
  return exerciseInsight(await loadAnalysisInput(), exerciseId, excludeSessionId);
}

/** Top alternatives for an exercise, given the user's equipment and this week's exercises. */
export async function getAlternatives(
  exerciseId: string,
  now = Date.now(),
): Promise<AlternativeScore[]> {
  return alternatives(await loadAnalysisInput(now), exerciseId);
}
