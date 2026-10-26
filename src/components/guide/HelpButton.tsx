import { CircleHelp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export interface HelpButtonProps {
  /** Guide heading anchor to open, e.g. `analyze-statuses`. */
  anchor: string;
  /** Human label for the aria-label; defaults to the anchor. */
  label?: string;
}

export default function HelpButton({ anchor, label }: HelpButtonProps) {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Help: ${label ?? anchor}`}
      data-testid={`help-${anchor}`}
      onClick={() => void navigate(`/guide#${anchor}`)}
    >
      <CircleHelp aria-hidden="true" />
    </Button>
  );
}
