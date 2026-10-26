import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
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
import { WHATS_NEW_ITEMS } from './whatsNewItems';

/** Shows once to existing users (onboarding done or sessions logged); reopenable via event. */
export default function WhatsNewDialog() {
  const seen = useLiveQuery(() => getFlag('whatsNewPhase3Seen'), []);
  const onboardingDone = useLiveQuery(() => getFlag('onboardingDone'), []);
  const sessionCount = useLiveQuery(() => db.sessions.count(), []);
  const [dismissed, setDismissed] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => onOpenWhatsNew(() => setManual(true)), []);

  const existingUser = onboardingDone === true || (sessionCount ?? 0) > 0;
  const auto = seen === false && existingUser && !dismissed;
  const open = manual || auto;

  function dismiss() {
    setManual(false);
    setDismissed(true);
    void setFlag('whatsNewPhase3Seen', true);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent data-testid="whats-new-dialog" className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>What&apos;s new in phase 3</DialogTitle>
          <DialogDescription>
            Everything stays on your device. Tap a feature to learn more.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {WHATS_NEW_ITEMS.map((it) => (
            <li key={it.anchor}>
              <Link
                to={`/guide#${it.anchor}`}
                onClick={dismiss}
                className="text-primary font-medium underline underline-offset-2"
              >
                {it.title}
              </Link>
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
