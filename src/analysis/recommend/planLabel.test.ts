import { describe, expect, it } from 'vitest';
import { planLabel } from './planLabel';

describe('planLabel', () => {
  it('labels a pyramid up as ranges', () => {
    expect(
      planLabel(
        'pyramid_up',
        [
          { weightKg: 60, reps: 15 },
          { weightKg: 65, reps: 11 },
          { weightKg: 70, reps: 6 },
        ],
        'kg',
      ),
    ).toBe('Pyramid ▲ · 60→70 kg × 15→6');
  });
  it('labels a flat plan as a single weight and reps', () => {
    expect(planLabel('progression', Array(5).fill({ weightKg: 80, reps: 5 }), 'kg')).toBe(
      'Progression · 80 kg × 5',
    );
  });
  it('labels reps-only plans', () => {
    expect(planLabel('pitt_force', [{ reps: 20 }], 'kg')).toBe('PITT-Force · 20 reps');
    expect(planLabel('pyramid_down', [{ reps: 8 }, { reps: 12 }], 'kg')).toBe(
      'Pyramid ▼ · 8→12 reps',
    );
  });
  it('converts weights to lbs', () => {
    expect(planLabel('progression', [{ weightKg: 100, reps: 5 }], 'lbs')).toBe(
      'Progression · 220 lbs × 5',
    );
  });
});
