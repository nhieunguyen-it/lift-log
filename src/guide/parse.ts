/** Small block-level Markdown parser for guide content (no HTML support by design). */

export type CalloutKind = 'TIP' | 'NOTE' | 'HEURISTIC';
export type Align = 'left' | 'center' | 'right' | undefined;

export interface ListItem {
  text: string;
  /** One nesting level only. */
  sub?: { ordered: boolean; items: string[] };
}

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string; id?: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: ListItem[] }
  | { type: 'table'; header: string[]; align: Align[]; rows: string[][] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'callout'; kind: CalloutKind; blocks: Block[] }
  | { type: 'quote'; blocks: Block[] }
  | { type: 'hr' };

const HEADING = /^(#{1,4})\s+(.+?)\s*$/;
const ANCHOR = /\s*\{#([A-Za-z0-9_-]+)\}\s*$/;
const FENCE = /^```\s*([\w-]*)\s*$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)\d+[.)]\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const HR = /^\s*([-*_])\1{2,}\s*$/;
const CALLOUT = /^\[!(TIP|NOTE|HEURISTIC)\]\s*$/;

function isFence(line: string): boolean {
  return FENCE.test(line.trim()) && line.trimStart().startsWith('```');
}
function isTableStart(lines: string[], i: number): boolean {
  const l = lines[i] ?? '';
  const n = lines[i + 1];
  return l.includes('|') && n !== undefined && n.includes('|') && TABLE_SEP.test(n);
}
function listMatch(line: string): { indent: number; ordered: boolean; text: string } | null {
  const b = BULLET.exec(line);
  if (b) return { indent: b[1].length, ordered: false, text: b[2] };
  const o = ORDERED.exec(line);
  if (o) return { indent: o[1].length, ordered: true, text: o[2] };
  return null;
}
function startsBlock(lines: string[], i: number): boolean {
  const l = lines[i];
  return (
    HEADING.test(l) ||
    isFence(l) ||
    /^\s*>/.test(l) ||
    listMatch(l) !== null ||
    HR.test(l) ||
    isTableStart(lines, i)
  );
}

export function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}

export function parseHeadingText(raw: string): { text: string; id?: string } {
  const m = ANCHOR.exec(raw);
  if (!m) return { text: raw.trim() };
  return { text: raw.slice(0, m.index).trim(), id: m[1] };
}

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (isFence(line)) {
      const lang = FENCE.exec(line.trim())?.[1] ?? '';
      const body: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '```') body.push(lines[i++]);
      i++; // closing fence
      out.push({ type: 'code', lang, text: body.join('\n') });
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      out.push({
        type: 'heading',
        level: h[1].length as 1 | 2 | 3 | 4,
        ...parseHeadingText(h[2]),
      });
      i++;
      continue;
    }
    if (HR.test(line) && !listMatch(line)) {
      out.push({ type: 'hr' });
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]))
        inner.push(lines[i++].replace(/^\s*>\s?/, ''));
      const co = CALLOUT.exec(inner[0].trim());
      if (co) {
        out.push({
          type: 'callout',
          kind: co[1] as CalloutKind,
          blocks: parseBlocks(inner.slice(1).join('\n')),
        });
      } else {
        out.push({ type: 'quote', blocks: parseBlocks(inner.join('\n')) });
      }
      continue;
    }
    if (isTableStart(lines, i)) {
      const header = splitRow(line);
      const align = splitRow(lines[i + 1]).map<Align>((c) =>
        c.startsWith(':') && c.endsWith(':')
          ? 'center'
          : c.endsWith(':')
            ? 'right'
            : c.startsWith(':')
              ? 'left'
              : undefined,
      );
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(splitRow(lines[i++]));
      }
      out.push({ type: 'table', header, align, rows });
      continue;
    }
    const lm = listMatch(line);
    if (lm) {
      const baseIndent = lm.indent;
      const ordered = lm.ordered;
      const items: ListItem[] = [];
      while (i < lines.length && lines[i].trim()) {
        const cur = listMatch(lines[i]);
        if (cur) {
          if (cur.indent > baseIndent && items.length) {
            const last = items[items.length - 1];
            if (!last.sub) last.sub = { ordered: cur.ordered, items: [] };
            last.sub.items.push(cur.text);
          } else if (cur.ordered === ordered) {
            items.push({ text: cur.text });
          } else break;
        } else if (/^\s+\S/.test(lines[i]) && items.length) {
          const last = items[items.length - 1];
          if (last.sub) last.sub.items[last.sub.items.length - 1] += ' ' + lines[i].trim();
          else last.text += ' ' + lines[i].trim();
        } else break;
        i++;
      }
      out.push({ type: 'list', ordered, items });
      continue;
    }
    const para: string[] = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines, i))
      para.push(lines[i++].trim());
    out.push({ type: 'paragraph', text: para.join(' ') });
  }
  return out;
}

/** Markdown lines outside fenced code blocks. */
export function nonCodeLines(markdown: string): string[] {
  const res: string[] = [];
  let inFence = false;
  for (const l of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    if (isFence(l)) {
      inFence = !inFence;
      continue;
    }
    if (inFence && l.trim() === '```') {
      inFence = false;
      continue;
    }
    if (!inFence) res.push(l);
  }
  return res;
}

/** Plain text of inline Markdown (for search and snippets). */
export function stripInline(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\w])[*_]([^*_]+)[*_](?=[^\w]|$)/g, '$1$2')
    .replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '$1');
}

/** Plain text of a block list, one entry per text-bearing block. */
export function blockText(blocks: Block[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'paragraph':
        out.push(stripInline(b.text));
        break;
      case 'list':
        for (const it of b.items) {
          out.push(stripInline(it.text));
          for (const s of it.sub?.items ?? []) out.push(stripInline(s));
        }
        break;
      case 'table':
        out.push(b.header.map(stripInline).join(' '));
        for (const r of b.rows) out.push(r.map(stripInline).join(' '));
        break;
      case 'code':
        out.push(b.text);
        break;
      case 'callout':
      case 'quote':
        out.push(...blockText(b.blocks));
        break;
      default:
        break;
    }
  }
  return out;
}
