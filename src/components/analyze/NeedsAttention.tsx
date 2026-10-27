import { useState } from 'react';
import { AlertTriangle, ChevronRight, TrendingDown } from 'lucide-react';
import type { AttentionItem } from '@/analyzer';
import type { MuscleId } from '@/data';
import { TRAINING } from '@/config/training';
import { Button } from '@/components/ui/button';
import { visibleCount } from './analyzeModel';
import { fmtSets, muscleName } from './muscleSort';

interface Props {
  items: AttentionItem[];
  onSelect: (id: MuscleId) => void;
}

/** Attention rows shown before "Show all": half the collapsed-list size, so the top fits on screen. */
const LIMIT = Math.ceil(TRAINING.analyzeUi.collapsedRows / 2);

export default function NeedsAttention({ items, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const shown = items.slice(0, visibleCount(items.length, LIMIT, expanded));
  return (
    <section
      data-testid="needs-attention"
      aria-labelledby="needs-attention-h"
      className="space-y-1.5"
    >
      <h2 id="needs-attention-h" className="text-base font-medium">
        Needs attention
      </h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing below minimum or over your ceiling. Nice.
        </p>
      ) : (
        <>
          <ul className="divide-border divide-y rounded-lg border">
            {shown.map((a) => {
              const over = a.status === 'over';
              const Icon = over ? AlertTriangle : TrendingDown;
              return (
                <li key={a.muscleId}>
                  <button
                    type="button"
                    data-testid={`attention-${a.muscleId}`}
                    onClick={() => onSelect(a.muscleId)}
                    className="focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{muscleName(a.muscleId)}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        {fmtSets(a.sets)} sets,{' '}
                        {over ? `over MRV ${a.threshold}` : `under MEV ${a.threshold}`}
                      </span>
                    </span>
                    <ChevronRight className="text-muted-foreground size-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          {items.length > LIMIT && (
            <Button
              variant="ghost"
              className="min-h-11 w-full"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Show fewer' : `Show all ${items.length}`}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
