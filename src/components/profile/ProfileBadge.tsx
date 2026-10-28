import { useActiveProfileName } from '@/db';
import { cn } from '@/lib/utils';

export default function ProfileBadge({
  className,
  testId = 'profile-active-name',
}: {
  className?: string;
  testId?: string;
}) {
  const name = useActiveProfileName();
  return (
    <span
      data-testid={testId}
      aria-label={`Profile: ${name}`}
      title={name}
      className={cn(
        'bg-muted text-muted-foreground inline-block max-w-32 truncate rounded-full px-2.5 py-0.5 align-middle text-xs font-medium',
        className,
      )}
    >
      {name}
    </span>
  );
}
