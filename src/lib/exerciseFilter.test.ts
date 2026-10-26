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
  it('filters custom only and hides tombstones', () => {
    const base = list[0].exercise;
    const mk = (id: string, extra: object) => ({
      exercise: { ...base, id, name: id, aliases: [], ...extra },
      muscles: [],
    });
    const mixed = [
      ...list,
      mk('custom-a', { isCustom: true }),
      mk('custom-b', { isCustom: true, deletedAt: 5 }),
    ];
    expect(
      filterExercises(mixed, { query: '', customOnly: true }).map((r) => r.exercise.id),
    ).toEqual(['custom-a']);
    expect(filterExercises(mixed, { query: 'custom-b' })).toHaveLength(0);
  });
});
