export * from './engine';
export * from './recommend';
export * from './types';
export * from './targets';
export * from './queries/analyzeView';
export { alternatives as scoreAlternatives } from './recommend';
export { alternatives, exerciseInsight } from './queries/exerciseInsight';
export {
  deloadSignal,
  exerciseDeloadHint,
  e1rmHistory,
  // Aliased: the engine's `longTrend` (different signature) is already public here.
  longTrend as longTrendView,
} from './queries/progress';
export { planVsActual } from './queries/planVsActual';
export type { AnalysisClient } from './client';
