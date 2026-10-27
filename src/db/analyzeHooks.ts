import { useLiveQuery } from 'dexie-react-hooks';
import { getAnalyzeView } from './analyzeRepo';
import type { AnalyzeView } from './analyzeRepo';
import { getAnalyzeGrouping, setAnalyzeGrouping } from './settingsRepo';
import type { AnalyzeGrouping } from './settingsRepo';

export { setAnalyzeGrouping };
export type { AnalyzeGrouping, AnalyzeView };

/** Week analysis, suggestions and summary (live). `undefined` while loading. */
export const useAnalyzeView = (refTs: number): AnalyzeView | undefined =>
  useLiveQuery(() => getAnalyzeView(refTs), [refTs]);

/** Remembered muscle/group toggle. `undefined` while loading. */
export const useAnalyzeGrouping = (): AnalyzeGrouping | undefined =>
  useLiveQuery(() => getAnalyzeGrouping(), []);
