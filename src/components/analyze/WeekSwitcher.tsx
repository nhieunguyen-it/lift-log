import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WeekWindow } from '@/analyzer';
import { Button } from '@/components/ui/button';

export function formatWeekRange(w: WeekWindow): string {
  const s = new Date(w.start);
  const e = new Date(w.end);
  e.setDate(e.getDate() - 1);
  const mon = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' });
  return s.getMonth() === e.getMonth()
    ? `${s.getDate()}–${e.getDate()} ${mon(e)}`
    : `${s.getDate()} ${mon(s)} – ${e.getDate()} ${mon(e)}`;
}

export default function WeekSwitcher({
  window: w,
  isCurrent,
  onPrev,
  onNext,
}: {
  window: WeekWindow;
  isCurrent: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="size-11"
        aria-label="Previous week"
        data-testid="week-prev"
        onClick={onPrev}
      >
        <ChevronLeft />
      </Button>
      <div className="min-w-[5.5rem] text-center" aria-live="polite">
        <div className="text-sm leading-tight font-medium" data-testid="week-label">
          {formatWeekRange(w)}
        </div>
        <div className="text-muted-foreground text-[11px] leading-tight">
          {isCurrent ? 'This week' : 'Past week'}
        </div>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-11"
        aria-label="Next week"
        data-testid="week-next"
        disabled={isCurrent}
        onClick={onNext}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
