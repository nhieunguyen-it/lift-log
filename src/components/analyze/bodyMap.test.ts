import { describe, expect, it } from 'vitest';
import { MUSCLE_IDS } from '@/data';
import { BODY_REGIONS, SILHOUETTE, VIEW_BOXES } from './bodyMapPaths';
import { MAPPED_MUSCLES, regionsFor } from './muscleMapping';

describe('body map anatomy data', () => {
  it('maps every muscle on at least one view', () => {
    for (const id of MUSCLE_IDS) expect(MAPPED_MUSCLES.has(id)).toBe(true);
  });
  it('has one region per muscle per view with path data', () => {
    for (const view of ['front', 'back'] as const) {
      const ids = regionsFor(view).map((r) => r.muscleId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(SILHOUETTE[view].startsWith('M')).toBe(true);
      expect(VIEW_BOXES[view]).toMatch(/^\d+ \d+ \d+ \d+$/);
    }
    for (const r of BODY_REGIONS) expect(r.d.length).toBeGreaterThan(50);
  });
});
