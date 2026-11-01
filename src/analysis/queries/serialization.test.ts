import { describe, expect, it } from 'vitest';
import { getBuiltInProgram } from '@/program/templates';
import { generateTrainingData } from '../engine/fixtures';
import { analysis, analyzeView } from './analyzeView';
import { alternatives, exerciseInsight } from './exerciseInsight';
import { deloadSignal, e1rmHistory, exerciseDeloadHint, longTrend } from './progress';
import { planVsActual } from './planVsActual';
import { makeInput } from './testInput';

const DAY = 86_400_000;
const NOW = new Date(2026, 0, 7, 12).getTime();

const input = makeInput(
  generateTrainingData({
    weeks: 12,
    sessionsPerWeek: 4,
    startTs: NOW - 12 * 7 * DAY,
    seed: 7,
  }),
  { program: { active: getBuiltInProgram('builtin-full-body')!, blocks: {} } },
);

const roundTrips = (x: unknown) => expect(JSON.parse(JSON.stringify(x))).toEqual(x);

describe('JSON serialization', () => {
  it('AnalysisInput survives a JSON round trip', () => roundTrips(input));

  it.each([
    ['analyzeView', () => analyzeView(input, NOW)],
    ['analysis', () => analysis(input, NOW)],
    ['exerciseInsight', () => exerciseInsight(input, 'barbell-bench-press')],
    ['alternatives', () => alternatives(input, 'barbell-bench-press')],
    ['deloadSignal', () => deloadSignal(input)],
    ['exerciseDeloadHint', () => exerciseDeloadHint(input, 'barbell-bench-press')],
    ['longTrend', () => longTrend(input, NOW)],
    ['e1rmHistory', () => e1rmHistory(input, 'barbell-bench-press')],
    ['planVsActual', () => planVsActual(input, NOW)],
  ])('%s result survives a JSON round trip', (_n, run) => roundTrips(run()));
});
