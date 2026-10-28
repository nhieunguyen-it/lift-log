import { PROFILES } from '@/config/profiles';
import { TRAINING } from '@/config/training';

/** Values guide Markdown may reference with `{{path}}`. */
export const GUIDE_CONTEXT: Record<string, unknown> = {
  ...(TRAINING as unknown as Record<string, unknown>),
  profiles: { max: PROFILES.max, nameMaxLength: PROFILES.nameMaxLength },
};

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

function lookup(ctx: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (o, k) =>
        o !== null && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined,
      ctx,
    );
}

/** Replaces every `{{path}}`; collects paths that don't resolve to a number or string. */
export function resolvePlaceholders(
  md: string,
  ctx: Record<string, unknown> = GUIDE_CONTEXT,
): { text: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const text = md.replace(PLACEHOLDER, (m, path: string) => {
    const v = lookup(ctx, path);
    if (typeof v === 'number' || typeof v === 'string') return String(v);
    unresolved.push(path);
    return m;
  });
  return { text, unresolved };
}
