import { describe, expect, it } from 'vitest';
import { buildIndex, search } from './search';
import type { GuideTopic } from './types';

function corpus(n: number): GuideTopic[] {
  return Array.from({ length: n }, (_, t) => {
    const slug = `topic${t}`;
    const sections = Array.from(
      { length: 8 },
      (_, s) =>
        `## Section ${s} about volume {#${slug}-s${s}}\n\n` +
        Array.from({ length: 6 }, (_, p) =>
          `Paragraph ${p} discusses recovery, fatigue and sets for lesson ${t}.${s}. `.repeat(3),
        ).join('\n\n'),
    );
    return {
      slug,
      title: `Topic ${t}`,
      order: t,
      markdown: `# Topic ${t} {#${slug}}\n\nIntro.\n\n${sections.join('\n\n')}\n\n## Special {#${slug}-special}\n\nZebrafish${t} appear here.`,
    };
  });
}

describe('guide search', () => {
  it('finds sections and weights titles', () => {
    const topics: GuideTopic[] = [
      {
        slug: 'a',
        title: 'A',
        order: 1,
        markdown:
          '# A {#a}\n\n## Deload {#a-deload}\n\nRest week.\n\n## Other {#a-other}\n\nA deload is mentioned once.',
      },
    ];
    const res = search(buildIndex(topics), 'deload');
    expect(res.map((r) => r.anchorId)).toEqual(['a-deload', 'a-other']);
    expect(res[0]).toMatchObject({ topicSlug: 'a', heading: 'Deload' });
    expect(res[1].snippet).toContain('deload');
  });
  it('returns nothing for no match or empty query', () => {
    const idx = buildIndex(corpus(2));
    expect(search(idx, 'qqqqnotthere')).toEqual([]);
    expect(search(idx, '   ')).toEqual([]);
  });
  it('searches a 15-topic corpus in under 50 ms', () => {
    const idx = buildIndex(corpus(15));
    expect(idx.length).toBeGreaterThan(100);
    const t0 = performance.now();
    for (const q of ['volume', 'recovery fatigue', 'zebrafish7', 'lesson 3.4']) search(idx, q);
    expect((performance.now() - t0) / 4).toBeLessThan(50);
    expect(search(idx, 'zebrafish7')[0].anchorId).toBe('topic7-special');
  });
});
