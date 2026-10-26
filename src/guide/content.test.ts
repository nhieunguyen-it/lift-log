import { describe, expect, it } from 'vitest';
import { TRAINING } from '@/config/training';
import { assertValidGuide, parseGuideFiles, RAW_GUIDE_FILES } from './content';
import { findLiteralViolations, trainingNumbers } from './literals';

const good = (slug: string, extra = '') =>
  `# ${slug} title {#${slug}}\n\nIntro.\n\n## Part {#${slug}-part}\n\nText ${extra}\n`;

describe('guide content (real files)', () => {
  const topics = assertValidGuide();
  it('has unique slugs and anchors, resolved placeholders, alt text', () => {
    const slugs = topics.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(topics.every((t) => !/\{\{/.test(t.markdown))).toBe(true);
  });
  it('contains no literal thresholds outside placeholders', () => {
    const nums = trainingNumbers();
    const bad = Object.entries(RAW_GUIDE_FILES).flatMap(([path, raw]) =>
      findLiteralViolations(raw, nums).map((v) => `${path}: ${v.value} in "${v.line}"`),
    );
    expect(bad).toEqual([]);
  });
});

describe('guide validator', () => {
  it('accepts well-formed content and sorts by order', () => {
    const { topics, errors } = parseGuideFiles({
      './content/02-b.md': good('b'),
      './content/01-a.md': good('a', '{{maxCountedRir}}'),
    });
    expect(errors).toEqual([]);
    expect(topics.map((t) => t.slug)).toEqual(['a', 'b']);
    expect(topics[0].markdown).toContain(`Text ${TRAINING.maxCountedRir}`);
  });
  it('rejects bad file names, duplicate slugs and anchors', () => {
    expect(parseGuideFiles({ './content/x.md': good('x') }).errors[0]).toMatch(/NN-slug/);
    expect(
      parseGuideFiles({
        './content/01-a.md': good('a'),
        './content/02-a.md': good('a'),
      }).errors.join(),
    ).toMatch(/duplicate topic slug/);
    expect(
      parseGuideFiles({ './content/01-a.md': good('a') + '\n## Again {#a-part}\n' }).errors.join(),
    ).toMatch(/already used/);
  });
  it('rejects unresolved placeholders, missing anchors, bad prefix, empty alt, raw HTML', () => {
    const e = (md: string) => parseGuideFiles({ './content/01-a.md': md }).errors.join('\n');
    expect(e(good('a', '{{nope}}'))).toMatch(/unresolved placeholder/);
    expect(e(good('a') + '\n## No anchor\n')).toMatch(/no \{#id\}/);
    expect(e(good('a') + '\n## Wrong {#zzz}\n')).toMatch(/prefixed/);
    expect(e(good('a') + '\n![](/guide/x.png)\n')).toMatch(/alt text/);
    expect(e(good('a') + '\n<div>hi</div>\n')).toMatch(/raw HTML/);
    expect(() => assertValidGuide({ './content/01-a.md': '# no anchor\n' })).toThrow();
  });
});

describe('literal threshold check', () => {
  const nums = trainingNumbers();
  it('collects config numbers', () => {
    for (const n of ['4', '8', '12', '18', '22', '2.5', '10', '50', '3', '5', '20'])
      expect(nums.has(n)).toBe(true);
  });
  it('flags literals but not placeholders, anchors, list numbers, links or the allow-list', () => {
    expect(findLiteralViolations('MEV is 8 sets.').map((v) => v.value)).toEqual(['8']);
    expect(
      findLiteralViolations('Hold at {{missesToHold}} misses {#x-8}\n1. step\n[a](/g#a-12)'),
    ).toEqual([]);
    expect(findLiteralViolations('Year 2025 and 18kg')).toEqual([]);
    expect(findLiteralViolations('4 sets → chest 4, triceps 2, front delts 2')).toEqual([]);
    expect(findLiteralViolations('```\n8\n```')).toEqual([]);
  });
});
