import { Dumbbell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function CustomBadge({ className }: { className?: string }) {
  return (
    <Badge variant="default" data-testid="custom-badge" className={className}>
      Custom
    </Badge>
  );
}

/** Stand-in for the photo that seed exercises have. */
export function ExercisePlaceholder({
  size = 56,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        'bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-md',
        className,
      )}
    >
      <Dumbbell className="size-1/2" />
    </span>
  );
}
