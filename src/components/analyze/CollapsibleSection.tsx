import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  testId?: string;
  defaultOpen?: boolean;
  /** Short text shown beside the title when collapsed. */
  hint?: string;
  children: ReactNode;
}

/** An h2 section whose heading is a toggle button; children mount only while open. */
export default function CollapsibleSection({
  title,
  testId,
  defaultOpen = false,
  hint,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section data-testid={testId} className="space-y-2">
      <h2 className="text-base font-medium">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="focus-visible:ring-ring/50 flex min-h-11 w-full items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-[3px]"
        >
          <span>
            {title}
            {!open && hint && (
              <span className="text-muted-foreground ml-2 text-xs font-normal">{hint}</span>
            )}
          </span>
          <span className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
            {open ? 'Hide' : 'Show all'}
            <ChevronDown className={cn('size-4', open && 'rotate-180')} aria-hidden="true" />
          </span>
        </button>
      </h2>
      <div id={id} hidden={!open}>
        {open && children}
      </div>
    </section>
  );
}
