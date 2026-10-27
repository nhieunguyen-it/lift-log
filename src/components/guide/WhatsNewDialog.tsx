import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { db } from '@/db/db';
import { getFlag, setFlag } from '@/db/settingsRepo';
import { onOpenWhatsNew } from './overlayEvents';

/** Phase 4 highlights (plain text: nothing here needs a guide anchor). */
export const PHASE4_ITEMS: { title: string; blurb: string }[] = [
  {
    title: 'Weekly summary',
    blurb: 'Analyze opens with totals, a status bar and what needs attention.',
  },
  { title: 'Legend filter', blurb: 'Tap a status in the legend to highlight just those muscles.' },
  { title: 'Range bars', blurb: 'Each muscle shows where its sets sit against its target range.' },
  {
    title: 'Blocks with a planned deload',
    blurb: 'Run a program as a block that ramps sets, then deloads.',
  },
  { title: 'Plan vs. actual', blurb: 'See which planned days and sets you missed this week.' },
  { title: 'Exercise hints', blurb: 'A dismissible note when one lift shows signs of fatigue.' },
  {
    title: 'New exercises',
    blurb: 'More arm and push-up variations: curls, pushdowns, incline and decline push-ups.',
  },
];

/**
 * Shows once to existing users (onboarding done or sessions logged); reopenable via event.
 * Automatic display is phase 4 only: if phase 3 was never seen either, both flags are marked
 * seen on dismiss so the two dialogs never stack. The manual reopen shows the same phase 4 list.
 */
export default function WhatsNewDialog() {
  const seen3 = useLiveQuery(() => getFlag('whatsNewPhase3Seen'), []);
  const seen4 = useLiveQuery(() => getFlag('whatsNewPhase4Seen'), []);
  const onboardingDone = useLiveQuery(() => getFlag('onboardingDone'), []);
  const sessionCount = useLiveQuery(() => db.sessions.count(), []);
  const [dismissed, setDismissed] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => onOpenWhatsNew(() => setManual(true)), []);

  const existingUser = onboardingDone === true || (sessionCount ?? 0) > 0;
  const auto = seen4 === false && existingUser && !dismissed;
  const open = manual || auto;

  function dismiss() {
    setManual(false);
    setDismissed(true);
    void setFlag('whatsNewPhase4Seen', true);
    if (seen3 === false) void setFlag('whatsNewPhase3Seen', true);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent data-testid="whats-new-dialog" className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>What&apos;s new in phase 4</DialogTitle>
          <DialogDescription>Everything stays on your device.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {PHASE4_ITEMS.map((it) => (
            <li key={it.title}>
              <p className="font-medium">{it.title}</p>
              <p className="text-muted-foreground text-sm">{it.blurb}</p>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button data-testid="whats-new-dismiss" onClick={dismiss}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
