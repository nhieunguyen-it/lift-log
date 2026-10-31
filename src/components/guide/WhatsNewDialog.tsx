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

/** Phase 5 highlights (plain text: nothing here needs a guide anchor). */
export const PHASE5_ITEMS: { title: string; blurb: string }[] = [
  {
    title: 'Profiles',
    blurb: 'Keep separate training logs on one device. Your data so far is the Default profile.',
  },
  { title: 'Profile switcher', blurb: 'Tap the circle at the top to switch or add a profile.' },
  {
    title: 'Fully separate',
    blurb: 'Each profile has its own workouts, settings, programs and custom exercises.',
  },
  {
    title: 'Import into a new profile',
    blurb: 'Restore a backup as its own profile without touching the current one.',
  },
  {
    title: 'Not a lock',
    blurb: 'Profiles are a convenience on this device, not a security feature.',
  },
];

/** Cardio highlights (plain text: nothing here needs a guide anchor). */
export const CARDIO_ITEMS: { title: string; blurb: string }[] = [
  {
    title: 'Cardio exercises',
    blurb:
      'Running, Cycling (outdoor) and Swimming (Freestyle and Breaststroke) are now in the picker.',
  },
  {
    title: 'Log minutes, not reps',
    blurb: 'Enter minutes, pick Relaxed, Moderate or Hard and see the estimated distance.',
  },
  {
    title: 'Counts toward muscles',
    blurb: 'Your minutes become hard sets on the Analyze tab.',
  },
];

/**
 * Shows once to existing users (onboarding done or sessions logged); reopenable via event.
 * Automatic display is the latest (cardio) list only: any earlier unseen flags are marked seen on
 * dismiss so the dialogs never stack. New profiles start with every flag set. The manual reopen
 * shows the same cardio list.
 */
export default function WhatsNewDialog() {
  const seen3 = useLiveQuery(() => getFlag('whatsNewPhase3Seen'), []);
  const seen4 = useLiveQuery(() => getFlag('whatsNewPhase4Seen'), []);
  const seen5 = useLiveQuery(() => getFlag('whatsNewPhase5Seen'), []);
  const seenCardio = useLiveQuery(() => getFlag('whatsNewCardioSeen'), []);
  const onboardingDone = useLiveQuery(() => getFlag('onboardingDone'), []);
  const sessionCount = useLiveQuery(() => db.sessions.count(), []);
  const [dismissed, setDismissed] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => onOpenWhatsNew(() => setManual(true)), []);

  const existingUser = onboardingDone === true || (sessionCount ?? 0) > 0;
  const auto = seenCardio === false && existingUser && !dismissed;
  const open = manual || auto;

  function dismiss() {
    setManual(false);
    setDismissed(true);
    void setFlag('whatsNewCardioSeen', true);
    if (seen5 === false) void setFlag('whatsNewPhase5Seen', true);
    if (seen4 === false) void setFlag('whatsNewPhase4Seen', true);
    if (seen3 === false) void setFlag('whatsNewPhase3Seen', true);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent data-testid="whats-new-dialog" className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>What&apos;s new: cardio</DialogTitle>
          <DialogDescription>Everything stays on your device.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {CARDIO_ITEMS.map((it) => (
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
