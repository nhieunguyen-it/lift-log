import { Badge } from '@/components/ui/badge';

export function CardioBadge({ className }: { className?: string }) {
  return (
    <Badge variant="default" data-testid="cardio-badge" className={className}>
      Cardio
    </Badge>
  );
}
