import { useEffect, useMemo, useState } from 'react';
import { ArrowUp, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { openOnboarding, openWhatsNew } from '@/components/guide/overlayEvents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loadGuideTopics } from '@/guide/content';
import { Markdown } from '@/guide/markdown';
import { parseBlocks } from '@/guide/parse';
import { buildIndex, search } from '@/guide/search';

function scrollToTop() {
  window.scrollTo?.({ top: 0 });
  document.getElementById('guide-title')?.focus({ preventScroll: true });
}

export default function GuidePage() {
  const topics = useMemo(() => loadGuideTopics(), []);
  const index = useMemo(() => buildIndex(topics), [topics]);
  const toc = useMemo(
    () =>
      topics.map((t) => ({
        ...t,
        sections: parseBlocks(t.markdown).flatMap((b) =>
          b.type === 'heading' && b.level === 2 && b.id ? [{ id: b.id, text: b.text }] : [],
        ),
      })),
    [topics],
  );
  const [query, setQuery] = useState('');
  const results = useMemo(() => search(index, query), [index, query]);
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    let id = location.hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      /* keep raw id */
    }
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView?.({ block: 'start' });
    el.focus({ preventScroll: true });
  }, [location.hash, location.key]);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 id="guide-title" tabIndex={-1} className="text-2xl font-semibold outline-none">
          User guide
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            data-testid="guide-replay-onboarding"
            onClick={openOnboarding}
          >
            Replay onboarding
          </Button>
          <Button variant="outline" size="sm" data-testid="guide-whats-new" onClick={openWhatsNew}>
            What&apos;s new in phase 3
          </Button>
        </div>
      </div>

      <div role="search" className="space-y-2">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            aria-label="Search the guide"
            placeholder="Search the guide"
            data-testid="guide-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {query.trim() && (
          <div aria-live="polite" data-testid="guide-search-results">
            {results.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No results for &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              <ul className="divide-border border-border divide-y rounded-md border">
                {results.map((r) => (
                  <li key={r.anchorId}>
                    <Link
                      to={{ pathname: '/guide', hash: `#${r.anchorId}` }}
                      onClick={() => setQuery('')}
                      className="focus-visible:ring-ring/50 block rounded-md p-3 outline-none focus-visible:ring-[3px]"
                    >
                      <span className="block font-medium">{r.heading}</span>
                      <span className="text-muted-foreground block text-sm">{r.snippet}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {topics.length === 0 ? (
        <p className="text-muted-foreground">The guide has no topics yet.</p>
      ) : (
        <>
          <nav aria-label="Guide contents" className="space-y-2">
            <h2 className="text-lg font-medium">Contents</h2>
            <ol className="space-y-2">
              {toc.map((t) => (
                <li key={t.slug}>
                  <Link
                    to={{ hash: `#${t.slug}` }}
                    className="text-primary inline-flex min-h-11 items-center font-medium underline underline-offset-2"
                  >
                    {t.title}
                  </Link>
                  {t.sections.length > 0 && (
                    <ul className="text-muted-foreground ml-4 list-disc space-y-1 text-sm">
                      {t.sections.map((s) => (
                        <li key={s.id}>
                          <Link to={{ hash: `#${s.id}` }} className="underline underline-offset-2">
                            {s.text}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          {topics.map((t) => (
            <article key={t.slug} className="border-border space-y-3 border-t pt-6">
              <Markdown source={t.markdown} headingOffset={1} />
              <Button variant="ghost" size="sm" onClick={scrollToTop}>
                <ArrowUp aria-hidden="true" />
                Back to top
              </Button>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
