import { describe, expect, it } from 'vitest';
import { exercises } from '@/data';
import { nextTarget } from './progression';

const ex = (id: string) => exercises.find((e) => e.id === id)!;
const top = (reps: number) => [
  { sessionId: 's', startedAt: 1, sets: [{ reps, rir: 1 }, { reps }] },
];

describe('variant progression', () => {
  it('names the next variant when a bodyweight exercise tops its range', () => {
    const t = nextTarget({
      exercise: ex('push-up'),
      primaryMuscleIds: ['chest'],
      history: top(20),
      unit: 'kg',
      exercises,
    });
    expect(t.action).toBe('add_load_or_variant');
    expect(t.nextVariantId).toBe('decline-push-up');
    expect(t.label).toContain('Next: Decline Push-Up');
  });

  it('keeps the generic behavior at the end of a chain', () => {
    const t = nextTarget({
      exercise: ex('dip'),
      primaryMuscleIds: ['triceps'],
      history: top(20),
      unit: 'kg',
      exercises,
    });
    expect(t.action).toBe('add_load_or_variant');
    expect(t.nextVariantId).toBeUndefined();
    expect(t.label).toContain('Add weight or try a harder variation');
  });
});
