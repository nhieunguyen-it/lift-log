import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { parseBlocks, type Block, type CalloutKind } from './parse';

/*
 * Safe Markdown renderer. Everything is built as React elements; nothing is ever injected as
 * HTML, so raw HTML in the source is just text.
 */

const INLINE =
  /`([^`]+)`|!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([^*\s][^*]*?)\*|(?<![\w])_([^_\s][^_]*?)_(?![\w])|\\([\\`*_{}[\]()#+\-.!|])/g;

function isInternal(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

export function renderInline(text: string, keyPrefix = 'i'): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let n = 0;
  const re = new RegExp(INLINE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    last = m.index + m[0].length;
    const key = `${keyPrefix}-${n++}`;
    if (m[1] !== undefined) {
      nodes.push(
        <code key={key} className="bg-muted rounded px-1 py-0.5 font-mono text-[0.9em]">
          {m[1]}
        </code>,
      );
    } else if (m[3] !== undefined) {
      const alt = m[2];
      const src = m[3];
      nodes.push(
        isInternal(src) || /^https?:\/\//.test(src) ? (
          <img
            key={key}
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="border-border my-2 h-auto max-w-full rounded-md border"
          />
        ) : (
          alt
        ),
      );
    } else if (m[5] !== undefined) {
      const href = m[5];
      const inner = renderInline(m[4], key);
      const cls = 'text-primary underline underline-offset-2';
      if (href.startsWith('#') || isInternal(href)) {
        nodes.push(
          <Link key={key} to={href} className={cls}>
            {inner}
          </Link>,
        );
      } else if (/^https?:\/\//.test(href)) {
        nodes.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={cls}>
            {inner}
          </a>,
        );
      } else {
        nodes.push(...inner);
      }
    } else if (m[6] !== undefined || m[7] !== undefined) {
      nodes.push(<strong key={key}>{renderInline(m[6] ?? m[7], key)}</strong>);
    } else if (m[8] !== undefined || m[9] !== undefined) {
      nodes.push(<em key={key}>{renderInline(m[8] ?? m[9], key)}</em>);
    } else if (m[10] !== undefined) {
      nodes.push(m[10]);
    }
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const CALLOUT_LABEL: Record<CalloutKind, string> = {
  TIP: 'Tip',
  NOTE: 'Note',
  HEURISTIC: 'Heuristic, not medical advice',
};
const CALLOUT_STYLE: Record<CalloutKind, string> = {
  TIP: 'border-primary',
  NOTE: 'border-muted-foreground',
  HEURISTIC: 'border-destructive',
};

const HEADING_STYLE: Record<number, string> = {
  1: 'text-2xl font-semibold',
  2: 'text-xl font-semibold',
  3: 'text-lg font-medium',
  4: 'text-base font-medium',
  5: 'text-base font-medium',
  6: 'text-sm font-medium',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function renderBlock(b: Block, key: string, offset: number): ReactNode {
  switch (b.type) {
    case 'heading': {
      const level = Math.min(6, b.level + offset);
      const Tag = `h${level}` as 'h2';
      const id = b.id ?? slugify(b.text);
      return (
        <Tag
          key={key}
          id={id}
          tabIndex={-1}
          className={cn('group scroll-mt-4 outline-none', HEADING_STYLE[level])}
        >
          {renderInline(b.text, key)}
          <Link
            to={{ hash: `#${id}` }}
            aria-label={`Link to section: ${b.text}`}
            className="text-muted-foreground focus-visible:ring-ring/50 ml-2 rounded px-1 text-sm no-underline opacity-60 outline-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px]"
          >
            #
          </Link>
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p key={key} className="leading-relaxed">
          {renderInline(b.text, key)}
        </p>
      );
    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul';
      return (
        <Tag key={key} className={cn('space-y-1 pl-6', b.ordered ? 'list-decimal' : 'list-disc')}>
          {b.items.map((it, i) => {
            const SubTag = it.sub?.ordered ? 'ol' : 'ul';
            return (
              <li key={i} className="leading-relaxed">
                {renderInline(it.text, `${key}-${i}`)}
                {it.sub && (
                  <SubTag
                    className={cn(
                      'mt-1 space-y-1 pl-5',
                      it.sub.ordered ? 'list-decimal' : 'list-disc',
                    )}
                  >
                    {it.sub.items.map((s, j) => (
                      <li key={j}>{renderInline(s, `${key}-${i}-${j}`)}</li>
                    ))}
                  </SubTag>
                )}
              </li>
            );
          })}
        </Tag>
      );
    }
    case 'table':
      return (
        <div key={key} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                {b.header.map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    style={{ textAlign: b.align[i] }}
                    className="border-border bg-muted border px-2 py-1.5 font-medium"
                  >
                    {renderInline(h, `${key}-h${i}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri}>
                  {b.header.map((_, ci) => (
                    <td
                      key={ci}
                      style={{ textAlign: b.align[ci] }}
                      className="border-border border px-2 py-1.5 align-top"
                    >
                      {renderInline(r[ci] ?? '', `${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'code':
      return (
        <pre
          key={key}
          tabIndex={0}
          className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-sm"
        >
          <code>{b.text}</code>
        </pre>
      );
    case 'callout':
      return (
        <aside
          key={key}
          role="note"
          data-callout={b.kind.toLowerCase()}
          className={cn(
            'bg-muted space-y-2 rounded-md border-l-4 p-3 text-sm',
            CALLOUT_STYLE[b.kind],
          )}
        >
          <p className="font-semibold">{CALLOUT_LABEL[b.kind]}</p>
          {b.blocks.map((c, i) => renderBlock(c, `${key}-${i}`, offset))}
        </aside>
      );
    case 'quote':
      return (
        <blockquote
          key={key}
          className="border-border text-muted-foreground space-y-2 border-l-4 pl-3"
        >
          {b.blocks.map((c, i) => renderBlock(c, `${key}-${i}`, offset))}
        </blockquote>
      );
    case 'hr':
      return <hr key={key} className="border-border" />;
  }
}

export interface MarkdownProps {
  source: string;
  /** Added to each heading level (h1 -> h2 when 1), capped at h6. */
  headingOffset?: number;
  className?: string;
}

export function Markdown({ source, headingOffset = 0, className }: MarkdownProps) {
  const blocks = parseBlocks(source);
  return (
    <div className={cn('space-y-3', className)}>
      {blocks.map((b, i) => renderBlock(b, `b${i}`, headingOffset))}
    </div>
  );
}
