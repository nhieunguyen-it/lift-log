import { EQUIPMENT } from '@/data/schema';
import { DEFAULT_TARGETS } from '@/config/training';
import type { TrainingData } from '../engine';
import type { AnalysisInput, AnalysisSettings } from '../types';

/** Test helper: an AnalysisInput with sensible defaults around the given data. */
export function makeInput(
  data: TrainingData,
  over: Partial<Omit<AnalysisInput, 'data' | 'settings'>> & {
    settings?: Partial<AnalysisSettings>;
  } = {},
): AnalysisInput {
  const { settings, ...rest } = over;
  return {
    data: data as AnalysisInput['data'],
    settings: {
      weekStartsOn: 1,
      targets: DEFAULT_TARGETS,
      equipment: [...EQUIPMENT],
      unit: 'kg',
      ...settings,
    },
    program: { active: null, blocks: {} },
    deloadDismissals: {},
    now: new Date(2026, 0, 7, 12).getTime(),
    ...rest,
  };
}
