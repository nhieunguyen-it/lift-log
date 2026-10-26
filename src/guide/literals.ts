import { TRAINING } from '@/config/training';
import { ALLOWED_LITERAL_PATTERNS } from './allowedLiterals';
import { nonCodeLines } from './parse';

/** Every config number the guide must reference through a placeholder, as display strings. */
export function trainingNumbers(t = TRAINING): Set<string> {
  const out = new Set<string>();
  const add = (n: number) => out.add(String(Math.round(n * 1e6) / 1e6));
  const walk = (v: unknown) => {
    if (typeof v === 'number') add(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(t.targets);
  walk(t.repRanges);
  walk(t.repRangeOverrides);
  walk(t.targetRir);
  walk(t.loadStepsKg);
  walk(t.loadStepsLbs);
  add(t.maxCountedRir);
  add(t.missesToHold);
  add(t.missesToDeload);
  add(t.deloadFraction * 100);
  const d = t.deload;
  walk({ ...d, e1rmDropFraction: 0, setsFraction: 0, dismissMs: 0 });
  add(d.e1rmDropFraction * 100);
  add(d.setsFraction * 100);
  add(d.dismissMs / 86_400_000);
  out.delete('0');
  return out;
}

const NUMBER = /(?<![\w.])\d+(?:\.\d+)?(?!\w)/g;

/** Lines (with offending numbers) where a config threshold appears as a literal. */
export function findLiteralViolations(
  rawMarkdown: string,
  numbers: Set<string> = trainingNumbers(),
  allowed: RegExp[] = ALLOWED_LITERAL_PATTERNS,
): { line: string; value: string }[] {
  const found: { line: string; value: string }[] = [];
  for (const line of nonCodeLines(rawMarkdown)) {
    let s = line
      .replace(/\{\{[^}]*\}\}/g, ' ')
      .replace(/\{#[^}]*\}/g, ' ')
      .replace(/\]\([^)]*\)/g, ']')
      .replace(/^\s*(?:>\s*)*\d+[.)]\s/, ' ');
    for (const a of allowed)
      s = s.replace(new RegExp(a.source, a.flags.includes('g') ? a.flags : a.flags + 'g'), ' ');
    for (const m of s.matchAll(NUMBER)) {
      if (numbers.has(m[0])) found.push({ line: line.trim(), value: m[0] });
    }
  }
  return found;
}
