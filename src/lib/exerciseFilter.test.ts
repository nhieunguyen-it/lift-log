import { describe, expect, it } from 'vitest';
import { exerciseMuscles, exercises } from '@/data';
import { filterExercises } from './exerciseFilter';

const list = exercises.map((exercise) => ({
  exercise,
  muscles: exerciseMuscles.filter((m) => m.exerciseId === exercise.id),
}));

describe('filterExercises', () => {
  it('matches names and aliases', () => {
    const byName = filterExercises(list, { query: 'back squat' });
    expect(byName.some((r) => r.exercise.id === 'barbell-back-squat')).toBe(true);
    const byAlias = filterExercises(list, { query: 'hyperextension' });
    expect(byAlias.map((r) => r.exercise.id)).toContain('back-extension');
  });
  it('filters by muscle and equipment', () => {
    const r = filterExercises(list, { query: '', muscleId: 'chest', equipment: 'barbell' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.exercise.equipment === 'barbell')).toBe(true);
  });
  it('puts recent exercises first', () => {
    const r = filterExercises(list, {
      query: '',
      recentIds: ['back-extension', 'ab-wheel-rollout'],
    });
    expect(r[0].exercise.id).toBe('back-extension');
    expect(r[1].exercise.id).toBe('ab-wheel-rollout');
  });
});
