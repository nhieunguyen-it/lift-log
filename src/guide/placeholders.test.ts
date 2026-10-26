import { describe, expect, it } from 'vitest';
import { resolvePlaceholders } from './placeholders';
import { TRAINING } from '@/config/training';

describe('guide placeholders', () => {
  it('resolves config paths', () => {
    const r = resolvePlaceholders('MEV {{targets.chest.mev}}, RIR ≤ {{ maxCountedRir }}');
    expect(r.text).toBe(`MEV ${TRAINING.targets.chest.mev}, RIR ≤ ${TRAINING.maxCountedRir}`);
    expect(r.unresolved).toEqual([]);
  });
  it('reports unknown and non-scalar paths', () => {
    expect(resolvePlaceholders('{{nope.x}} {{targets.chest}}').unresolved).toEqual([
      'nope.x',
      'targets.chest',
    ]);
  });
});
