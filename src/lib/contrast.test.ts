/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(`${process.cwd()}/src/index.css`, 'utf8');

/** WCAG AA checks for the Analyze status / chart tokens in both themes. */

function block(selector: ':root' | '.dark'): Record<string, string> {
  const vars: Record<string, string> = {};
  const re = new RegExp(`(^|\\n)${selector.replace('.', '\\.')} \\{([^}]*)\\}`, 'g');
  for (const m of css.matchAll(re)) {
    for (const d of m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[d[1]] = d[2].trim();
  }
  return vars;
}

function oklchToLinear(v: string): [number, number, number] {
  const m = /oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(v);
  if (!m) throw new Error(`not oklch: ${v}`);
  const [L, C, H] = [+m[1], +m[2], (+m[3] * Math.PI) / 180];
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s),
  ];
}
const lum = (v: string) => {
  const [r, g, b] = oklchToLinear(v);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const STATUSES = ['none', 'below', 'building', 'optimal', 'high', 'over'];

describe.each([':root', '.dark'] as const)('contrast %s', (sel) => {
  const base = block(':root');
  const v = sel === ':root' ? base : { ...base, ...block('.dark') };
  it.each(STATUSES)('%s text on its fill >= 4.5', (s) => {
    expect(ratio(v[`st-${s}-fg`], v[`st-${s}-bg`])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(STATUSES)('%s strong tone vs card >= 3', (s) => {
    expect(ratio(v[`st-${s}-strong`], v.card)).toBeGreaterThanOrEqual(3);
  });
  it('chart line, axis and markers vs card', () => {
    expect(ratio(v['chart-line'], v.card)).toBeGreaterThanOrEqual(3);
    expect(ratio(v['chart-axis'], v.card)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(v['chart-marker'], v.card)).toBeGreaterThanOrEqual(3);
    expect(ratio(v['chart-value'], v.card)).toBeGreaterThanOrEqual(4.5);
  });
});
