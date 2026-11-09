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
  it('omits the weight of a non-monotone plan', () => {
    expect(
      planLabel(
        'pyramid_up',
        [
          { weightKg: 105, reps: 15 },
          { weightKg: 100, reps: 14 },
          { weightKg: 105, reps: 12 },
        ],
        'kg',
      ),
    ).toBe('Pyramid ▲ · 15→12 reps');
    expect(
      planLabel(
        'progression',
        [
          { weightKg: 80, reps: 5 },
          { weightKg: 85, reps: 5 },
          { weightKg: 80, reps: 5 },
        ],
        'kg',
      ),
    ).toBe('Progression · 5 reps');
  });
  it('labels a monotone descending weight as a range', () => {
    expect(
      planLabel(
        'pyramid_down',
        [
          { weightKg: 70, reps: 6 },
          { weightKg: 70, reps: 9 },
          { weightKg: 60, reps: 12 },
        ],
        'kg',
      ),
    ).toBe('Pyramid ▼ · 70→60 kg × 6→12');
  });
  it('omits the weight when some sets have none', () => {
    expect(
      planLabel(
        'pyramid_up',
        [{ weightKg: 60, reps: 15 }, { reps: 11 }, { weightKg: 70, reps: 6 }],
        'kg',
      ),
    ).toBe('Pyramid ▲ · 15→6 reps');
  });
});
