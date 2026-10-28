import { useEffect, useState, type ReactNode } from 'react';
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
import { useUnit, useWeekStartsOn } from '@/db';
import { db } from '@/db/db';
import { getFlag, setFlag, setUnit, setWeekStartsOn } from '@/db/settingsRepo';
import type { WeekStartDay } from '@/analyzer/types';
import type { WeightUnit } from '@/lib/units';
import { onOpenOnboarding } from './overlayEvents';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LAST_STEP = 2;

export interface OnboardingProps {
  /** Optional program picker shown on step 3; without it the step just says where to find programs. */
  programChooser?: ReactNode;
}

export default function Onboarding({ programChooser }: OnboardingProps) {
  const done = useLiveQuery(() => getFlag('onboardingDone'), []);
  const sessionCount = useLiveQuery(() => db.sessions.count(), []);
  const unit = useUnit();
  const weekStartsOn = useWeekStartsOn();
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(
    () =>
      onOpenOnboarding(() => {
        setStep(0);
        setManual(true);
      }),
    [],
  );

  const auto = done === false && sessionCount === 0 && !closed;
  const open = manual || auto;

  function finish() {
    const wasAuto = auto;
    setManual(false);
    setClosed(true);
    void (async () => {
      // A brand-new user has nothing to catch up on, so skip the what's-new dialog too.
      if (wasAuto) {
        await setFlag('whatsNewPhase3Seen', true);
        await setFlag('whatsNewPhase4Seen', true);
        await setFlag('whatsNewPhase5Seen', true);
      }
      await setFlag('onboardingDone', true);
    })();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent data-testid="onboarding-dialog">
        {step === 0 && (
          <DialogHeader>
            <DialogTitle>Welcome to Lift Log</DialogTitle>
            <DialogDescription>
              A private workout log. Everything is stored on this device and works offline. This
              short tour sets a couple of preferences. You can skip it at any time.
            </DialogDescription>
          </DialogHeader>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Units and week start</DialogTitle>
              <DialogDescription>You can change these later in Settings.</DialogDescription>
            </DialogHeader>
            <div role="group" aria-label="Weight unit" className="grid grid-cols-2 gap-2">
              {(['kg', 'lbs'] as WeightUnit[]).map((u) => (
                <Button
                  key={u}
                  type="button"
                  variant={unit === u ? 'default' : 'outline'}
                  aria-pressed={unit === u}
                  data-testid={`onboarding-unit-${u}`}
                  onClick={() => void setUnit(u)}
                >
                  {u}
                </Button>
              ))}
            </div>
            <label className="block space-y-1 text-sm font-medium">
              Week starts on
              <select
                data-testid="onboarding-week-start"
                value={weekStartsOn ?? 1}
                onChange={(e) => void setWeekStartsOn(Number(e.target.value) as WeekStartDay)}
                className="border-input bg-background h-11 w-full rounded-md border px-3 text-sm font-normal"
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Pick a program (optional)</DialogTitle>
              <DialogDescription>
                {programChooser
                  ? 'Follow a routine, or skip and log freestyle workouts.'
                  : 'You can set up a program any time from the app. Logging freestyle workouts works fine too.'}
              </DialogDescription>
            </DialogHeader>
            {programChooser}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" data-testid="onboarding-skip" onClick={finish}>
            Skip
          </Button>
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              data-testid="onboarding-back"
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
          )}
          <Button
            type="button"
            data-testid="onboarding-next"
            onClick={() => (step >= LAST_STEP ? finish() : setStep(step + 1))}
          >
            {step >= LAST_STEP ? 'Done' : 'Next'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
