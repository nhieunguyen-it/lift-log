import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionExercise } from '@/analysis/rows';

const db = vi.hoisted(() => ({ plan: [] as { weightKg?: number; reps: number }[] | null }));

vi.mock('@/db', () => ({
  useSetPlan: () => db.plan,
  useUnit: () => 'kg',
  useExerciseInsight: () => ({
    target: { action: 'increase', label: 'Next: 100 kg × 8', reason: 'Last time 8 reps' },
  }),
  fillFromPlan: () => [],
  setsRepo: { updateSet: vi.fn(), addSet: vi.fn() },
}));

import TargetChip from './TargetChip';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const se: SessionExercise = {
  id: 'se1',
  sessionId: 's1',
  exerciseId: 'barbell-back-squat',
  order: 0,
  system: 'pyramid_up',
};

function render() {
  act(() => {
    root.render(
      <TargetChip
        exerciseId={se.exerciseId}
        sessionId={se.sessionId}
        sessionExerciseId={se.id}
        sets={[]}
        sessionExercise={se}
      />,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('TargetChip', () => {
  it('falls back to the next-set target when a snapshot exercise has no rows', () => {
    db.plan = [];
    render();
    expect(container.querySelector('[data-testid="target-chip"]')?.textContent).toContain(
      'Next: 100 kg × 8',
    );
  });

  it('shows the plan label when the plan has sets', () => {
    db.plan = [{ weightKg: 100, reps: 5 }];
    render();
    expect(container.querySelector('[data-testid="target-chip"]')?.textContent).toContain(
      'Pyramid ▲ · 100 kg × 5',
    );
  });
});
