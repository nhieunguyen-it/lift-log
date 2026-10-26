import { blockText, parseBlocks, stripInline } from './parse';
import type { GuideTopic } from './types';

export interface SearchSection {
  anchorId: string;
  topicSlug: string;
  topicTitle: string;
  heading: string;
  text: string;
  lowerHeading: string;
  lowerText: string;
}

export interface SearchResult {
  anchorId: string;
  topicSlug: string;
  heading: string;
  snippet: string;
}

export type SearchIndex = SearchSection[];

/** Splits every topic into sections at headings. */
export function buildIndex(topics: GuideTopic[]): SearchIndex {
  const index: SearchIndex = [];
  for (const topic of topics) {
    const blocks = parseBlocks(topic.markdown);
    let cur: { anchorId: string; heading: string; parts: typeof blocks } | null = null;
    const flush = () => {
      if (!cur) return;
      const text = blockText(cur.parts).join(' ');
      index.push({
        anchorId: cur.anchorId,
        topicSlug: topic.slug,
        topicTitle: topic.title,
        heading: cur.heading,
        text,
        lowerHeading: cur.heading.toLowerCase(),
        lowerText: text.toLowerCase(),
      });
    };
    for (const b of blocks) {
      if (b.type === 'heading') {
        flush();
        cur = { anchorId: b.id ?? topic.slug, heading: stripInline(b.text), parts: [] };
      } else if (cur) {
        cur.parts.push(b);
      }
    }
    flush();
  }
  return index;
}

function terms(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function countOccurrences(hay: string, needle: string): number {
  let n = 0;
  let i = hay.indexOf(needle);
  while (i !== -1 && n < 10) {
    n++;
    i = hay.indexOf(needle, i + needle.length);
  }
  return n;
}

function snippet(text: string, lowerText: string, ts: string[]): string {
  const max = 140;
  let pos = -1;
  for (const t of ts) {
    const p = lowerText.indexOf(t);
    if (p !== -1 && (pos === -1 || p < pos)) pos = p;
  }
  if (pos === -1) return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
  const start = Math.max(0, pos - 40);
  const end = Math.min(text.length, start + max);
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}

/** All terms must match (heading weighted 5x, body capped); results sorted by score. */
export function search(index: SearchIndex, query: string, limit = 20): SearchResult[] {
  const ts = terms(query);
  if (!ts.length) return [];
  const scored: { s: SearchSection; score: number }[] = [];
  for (const s of index) {
    let score = 0;
    let ok = true;
    for (const t of ts) {
      const inHead = countOccurrences(s.lowerHeading, t);
      const inText = countOccurrences(s.lowerText, t);
      if (!inHead && !inText) {
        ok = false;
        break;
      }
      score += inHead * 5 + inText;
    }
    if (ok) scored.push({ s, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ s }) => ({
    anchorId: s.anchorId,
    topicSlug: s.topicSlug,
    heading: s.heading,
    snippet: snippet(s.text, s.lowerText, ts),
  }));
}
