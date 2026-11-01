import type { E1rmPoint } from './engine';
import type { AlternativeScore, DeloadSignal } from './recommend';
import type {
  AnalysisView,
  AnalyzeView,
  ExerciseDeloadHint,
  ExerciseInsight,
  LongTrend,
  PlanVsActualView,
} from './types';

/**
 * The one seam between UI and analysis. Every method resolves to plain JSON-serializable
 * data, so a remote implementation can replace the local one without changing callers.
 */
export interface AnalysisClient {
  getAnalyzeView(refTs: number): Promise<AnalyzeView>;
  getAnalysis(refTs: number): Promise<AnalysisView>;
  getExerciseInsight(
    exerciseId: string,
    excludeSessionId?: string,
  ): Promise<ExerciseInsight | null>;
  getAlternatives(exerciseId: string, now?: number): Promise<AlternativeScore[]>;
  getDeloadSignal(now?: number): Promise<DeloadSignal | null>;
  getExerciseDeloadHint(exerciseId: string, now?: number): Promise<ExerciseDeloadHint | null>;
  getLongTrend(refTs?: number): Promise<LongTrend>;
  getE1rmHistory(exerciseId: string): Promise<E1rmPoint[]>;
  getPlanVsActual(refTs: number, now?: number): Promise<PlanVsActualView | null>;
}
