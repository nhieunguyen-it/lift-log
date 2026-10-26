import { nonCodeLines, parseBlocks } from './parse';
import { resolvePlaceholders } from './placeholders';
import type { GuideTopic } from './types';

/** Raw Markdown files keyed by path (`./content/NN-slug.md`). */
export const RAW_GUIDE_FILES = import.meta.glob('./content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const FILE = /(?:^|\/)(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const IMAGE = /!\[([^\]]*)\]\(([^)]*)\)/g;
const RAW_HTML = /<\/?[A-Za-z][^>]*>/;

/** Parses and checks every file; collects all problems instead of stopping at the first. */
export function parseGuideFiles(files: Record<string, string>): {
  topics: GuideTopic[];
  errors: string[];
} {
  const errors: string[] = [];
  const topics: GuideTopic[] = [];
  const slugs = new Set<string>();
  const anchors = new Map<string, string>();

  for (const [path, raw] of Object.entries(files)) {
    const fm = FILE.exec(path);
    if (!fm) {
      errors.push(`${path}: file name must be NN-slug.md`);
      continue;
    }
    const order = Number(fm[1]);
    const slug = fm[2];
    if (slugs.has(slug)) errors.push(`${path}: duplicate topic slug "${slug}"`);
    slugs.add(slug);

    const { text, unresolved } = resolvePlaceholders(raw);
    for (const u of unresolved) errors.push(`${path}: unresolved placeholder {{${u}}}`);

    const blocks = parseBlocks(text);
    const first = blocks[0];
    if (!first || first.type !== 'heading' || first.level !== 1) {
      errors.push(`${path}: must start with "# Title {#${slug}}"`);
      continue;
    }
    if (first.id !== slug) errors.push(`${path}: title anchor must be {#${slug}}`);

    for (const b of blocks) {
      if (b.type !== 'heading') continue;
      if (!b.id) {
        errors.push(`${path}: heading "${b.text}" has no {#id}`);
        continue;
      }
      if (b.id !== slug && !b.id.startsWith(`${slug}-`)) {
        errors.push(`${path}: anchor "${b.id}" must be prefixed with "${slug}-"`);
      }
      const prev = anchors.get(b.id);
      if (prev) errors.push(`${path}: anchor "${b.id}" already used in ${prev}`);
      anchors.set(b.id, path);
    }

    for (const line of nonCodeLines(text)) {
      for (const m of line.matchAll(IMAGE)) {
        if (!m[1].trim()) errors.push(`${path}: image "${m[2]}" is missing alt text`);
      }
      if (RAW_HTML.test(line.replace(/`[^`]*`/g, ''))) {
        errors.push(`${path}: raw HTML is not allowed: ${line.trim()}`);
      }
    }

    topics.push({ slug, title: first.text, order, markdown: text });
  }

  topics.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  return { topics, errors };
}

/** Throws one Error listing every problem; used by tests. */
export function assertValidGuide(files: Record<string, string> = RAW_GUIDE_FILES): GuideTopic[] {
  const { topics, errors } = parseGuideFiles(files);
  if (errors.length) throw new Error(`Invalid guide content:\n${errors.join('\n')}`);
  return topics;
}

export function loadGuideTopics(): GuideTopic[] {
  return parseGuideFiles(RAW_GUIDE_FILES).topics;
}
