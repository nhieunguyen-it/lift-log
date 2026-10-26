/**
 * Guide content contract.
 * - One Markdown file per topic in src/guide/content/NN-<slug>.md, bundled via import.meta.glob.
 * - First line: `# Title {#<slug>}`. Every heading carries an explicit stable anchor `{#id}`;
 *   ids are globally unique and prefixed by topic slug (e.g. `{#analyze-statuses}`).
 * - Numbers from config are written as placeholders `{{path}}` resolved against GUIDE_CONTEXT
 *   (see placeholders.ts), e.g. `{{targets.chest.mev}}`, `{{maxCountedRir}}`.
 * - Callouts: a blockquote whose first line is `[!TIP]`, `[!NOTE]` or `[!HEURISTIC]`.
 * - Images: `![alt text](/guide/<file>)`, files in public/guide/. Alt text is required.
 * - No raw HTML.
 */
export interface GuideTopic {
  slug: string;
  title: string;
  /** Sort order from the NN- filename prefix. */
  order: number;
  /** Markdown with placeholders already resolved. */
  markdown: string;
}
