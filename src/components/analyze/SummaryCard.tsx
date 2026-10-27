import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { WeekSummary } from '@/analyzer';
import { Card } from '@/components/ui/card';
import { deltaText } from './analyzeModel';
import StatusBar from './StatusBar';

export default function SummaryCard({ summary }: { summary: WeekSummary }) {
  const Icon = summary.delta > 0 ? ArrowUp : summary.delta < 0 ? ArrowDown : Minus;
  return (
    <Card
      className="space-y-2 p-3"
      data-testid="analyze-summary"
      aria-labelledby="analyze-summary-h"
    >
      <h2 id="analyze-summary-h" className="sr-only">
        Week summary
      </h2>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl leading-none font-semibold" data-testid="summary-total">
            {summary.totalSets}
            <span className="text-muted-foreground ml-1 text-sm font-normal">hard sets</span>
          </div>
          <div
            className="text-muted-foreground mt-1 flex items-center gap-1 text-xs"
            data-testid="summary-delta"
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {deltaText(summary.delta)}
          </div>
        </div>
        {summary.sessions && (
          <div className="text-right" data-testid="summary-sessions">
            <div className="text-lg leading-none font-semibold">
              {summary.sessions.done}
              <span className="text-muted-foreground text-sm font-normal">
                {' '}
                / {summary.sessions.planned}
              </span>
            </div>
            <div className="text-muted-foreground mt-1 text-xs">sessions done</div>
          </div>
        )}
      </div>
      <StatusBar counts={summary.statusCounts} />
    </Card>
  );
}
