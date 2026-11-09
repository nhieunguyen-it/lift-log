import { describe, expect, it } from 'vitest';
import { PITT_DEFAULT_RANGE, SYSTEM_INFO, systemOf } from './systems';
import { TRAINING_SYSTEMS } from './types';

describe('systems', () => {
  it('systemOf defaults to progression', () => {
    expect(systemOf({})).toBe('progression');
    expect(systemOf({ system: 'pitt_force' })).toBe('pitt_force');
  });

  it('has info for every system and a 20-20 PITT default', () => {
    for (const s of TRAINING_SYSTEMS) expect(SYSTEM_INFO[s].label).toBeTruthy();
    expect(PITT_DEFAULT_RANGE).toEqual({ min: 20, max: 20 });
  });
});
