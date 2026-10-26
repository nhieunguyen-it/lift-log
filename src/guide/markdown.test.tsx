import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Markdown } from './markdown';

const html = (source: string, headingOffset = 0) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={['/guide']}>
      <Markdown source={source} headingOffset={headingOffset} />
    </MemoryRouter>,
  );

describe('guide markdown renderer', () => {
  it('renders headings with anchors, tabindex and a visible # link', () => {
    const out = html('## Volume {#analyze-volume}');
    expect(out).toContain('<h2 id="analyze-volume" tabindex="-1"');
    expect(out).toContain('href="/guide#analyze-volume"');
    expect(out).toContain('>#</a>');
    expect(out).not.toContain('{#');
  });
  it('supports h1-h4 and heading offset', () => {
    const out = html('# A {#a}\n\n#### D {#d}', 1);
    expect(out).toContain('<h2 id="a"');
    expect(out).toContain('<h5 id="d"');
  });
  it('renders paragraphs and inline formatting', () => {
    const out = html('Some **bold**, *italic* and `code` text.');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<em>italic</em>');
    expect(out).toContain('>code</code>');
  });
  it('renders internal, anchor and external links', () => {
    const out = html('[a](/guide#x) [b](#y) [c](https://example.com) [d](javascript:alert(1))');
    expect(out).toContain('href="/guide#x"');
    expect(out).toContain('href="/guide#y"');
    expect(out).toContain('href="https://example.com" target="_blank" rel="noopener noreferrer"');
    expect(out).not.toContain('javascript:');
  });
  it('renders ordered and unordered lists with one nesting level', () => {
    const ul = html('- one\n- two\n  - nested\n- three');
    expect(ul).toContain('<ul');
    expect(ul.match(/<li/g)?.length).toBe(4);
    expect(html('1. a\n2. b')).toContain('<ol');
  });
  it('renders GFM tables with th scope', () => {
    const out = html('| A | B |\n|---|:-:|\n| 1 | 2 |');
    expect(out).toContain('<th scope="col"');
    expect(out).toContain('<td');
    expect(out).toContain('text-align:center');
  });
  it('renders fenced code verbatim', () => {
    const out = html('```ts\nconst a = <b>1</b>;\n```');
    expect(out).toContain('<pre');
    expect(out).toContain('&lt;b&gt;');
  });
  it('renders callouts as aside role=note with labels', () => {
    const out = html('> [!HEURISTIC]\n> Not advice.\n\n> [!TIP]\n> Try it.\n\n> [!NOTE]\n> FYI.');
    expect(out.match(/<aside role="note"/g)?.length).toBe(3);
    expect(out).toContain('Heuristic, not medical advice');
    expect(out).toContain('>Tip<');
    expect(out).toContain('>Note<');
  });
  it('renders images lazily with alt', () => {
    const out = html('![A chart](/guide/chart.png)');
    expect(out).toContain('src="/guide/chart.png"');
    expect(out).toContain('alt="A chart"');
    expect(out).toContain('loading="lazy"');
  });
  it('escapes raw HTML as text', () => {
    const out = html('<script>alert(1)</script> and <img src=x onerror=alert(1)>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;script&gt;');
  });
});
