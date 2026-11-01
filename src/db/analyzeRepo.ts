import { analyzeView } from '@/analysis';
import type { AnalyzeView } from '@/analysis';
import { loadAnalysisInput } from './localAnalysisClient';

export type { AnalyzeView };

/** Analysis + volume suggestions + the at-a-glance summary for the week containing `refTs`. */
export async function getAnalyzeView(refTs: number): Promise<AnalyzeView> {
  return analyzeView(await loadAnalysisInput(), refTs);
}
