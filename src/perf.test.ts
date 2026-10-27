import { describe, expect, it } from 'vitest';
import { exerciseMuscles, exercises } from '@/data';
import { TRAINING } from '@/config/training';
import {
  analyzeWeek,
  defaultAnalyzerOptions,
  longTrend,
  summarizeWeek,
  weekWindow,
  shiftWeek,
} from '@/analyzer';
import { generateTrainingData } from '@/analyzer/fixtures';
import { planCheck } from '@/program/planCheck';
import { newBlock, projectBlock } from '@/program/block';
import { comparePlanToActual } from '@/program/planVsActual';
import { BUILT_IN_PROGRAMS } from '@/program/templates';
import { detectDeload } from '@/recommend';
import { buildIndex, search } from '@/guide/search';
import { loadGuideTopics } from '@/guide/content';

const WEEK = 7 * 86_400_000;

describe('performance budgets', () => {
  const startTs = Date.UTC(2025, 0, 6);
  const data = generateTrainingData({ weeks: 52, sessionsPerWeek: 5, startTs, seed: 7 });
  const refTs = startTs + 52 * WEEK - 1;

  it('has a realistic year of data', () => {
    expect(data.sessions).toHaveLength(260);
    expect(data.sets.length).toBeGreaterThan(260 * 10);
  });

  it('planCheck + deload + 12-week trend < 200 ms', () => {
    const program = BUILT_IN_PROGRAMS[0];
    const opts = defaultAnalyzerOptions();
    // Warm up JIT so the budget measures steady state, as the app would after first render.
    planCheck(program, exercises, exerciseMuscles, TRAINING.targets);
    const t0 = performance.now();
    const plan = planCheck(program, exercises, exerciseMuscles, TRAINING.targets);
    const signal = detectDeload(data);
    const trend = longTrend(data, refTs, opts, 11);
    const ms = performance.now() - t0;
    expect(plan).toBeTruthy();
    expect(signal).toBeTruthy();
    expect(trend.biceps).toHaveLength(12);
    expect(ms).toBeLessThan(200);
  });

  it('Analyze view-model over a year < 100 ms', () => {
    const program = BUILT_IN_PROGRAMS[0];
    const opts = defaultAnalyzerOptions();
    const block = newBlock(refTs, opts.weekStartsOn, [program.days[0].exercises[0].exerciseId], 6);
    const planData = { exercises, exerciseMuscles, targets: TRAINING.targets };
    const build = () => {
      const win = weekWindow(refTs - WEEK, opts.weekStartsOn);
      const cur = analyzeWeek(data, win, opts);
      const prev = analyzeWeek(data, shiftWeek(win, -1, opts.weekStartsOn), opts);
      const summary = summarizeWeek(cur, prev, { sessionsDone: 3, plannedSessions: 5 });
      const plan = planCheck(program, exercises, exerciseMuscles, TRAINING.targets);
      const pva = comparePlanToActual(plan, cur, program.days, data.sessions);
      const proj = projectBlock(program, block, planData);
      const trend = longTrend(data, refTs, opts);
      return { summary, pva, proj, trend };
    };
    build(); // warm up JIT
    const t0 = performance.now();
    const out = build();
    const ms = performance.now() - t0;
    expect(out.summary.totalSets).toBeGreaterThan(0);
    expect(out.proj.weeks).toHaveLength(6);
    expect(out.pva.days).toHaveLength(program.days.length);
    expect(out.trend.biceps.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(100);
  });

  it('guide search < 50 ms', () => {
    const index = buildIndex(loadGuideTopics());
    const t0 = performance.now();
    const res = search(index, 'deload volume');
    const ms = performance.now() - t0;
    expect(res.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(50);
  });
});
