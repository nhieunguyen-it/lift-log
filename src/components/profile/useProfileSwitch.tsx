import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { profiles, useActiveSession } from '@/db';

export interface ProfileSwitch {
  /** Switches to the profile (reloads the page), asking first if a workout is in progress. */
  requestSwitch: (id: string) => void;
  /** Runs `action` (which ends in a reload), asking first if a workout is in progress. */
  runGuarded: (action: () => void | Promise<void>) => void;
  /** Render this once somewhere in the component tree. */
  guardDialog: ReactNode;
}

export function useProfileSwitch(): ProfileSwitch {
  const navigate = useNavigate();
  const session = useActiveSession();
  const [pending, setPending] = useState<(() => void | Promise<void>) | null>(null);

  function runGuarded(action: () => void | Promise<void>) {
    if (session) setPending(() => action);
    else void action();
  }

  const requestSwitch = (id: string) => runGuarded(() => profiles.switchProfile(id));

  const guardDialog = (
    <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
      <DialogContent data-testid="profile-guard-dialog">
        <DialogHeader>
          <DialogTitle>You have a workout in progress</DialogTitle>
          <DialogDescription>
            The workout stays in this profile either way. It will be waiting when you switch back.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            data-testid="profile-guard-proceed"
            onClick={() => {
              const action = pending;
              setPending(null);
              if (action) void action();
            }}
          >
            Keep workout and switch
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setPending(null);
              void navigate('/');
            }}
          >
            Go back to workout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { requestSwitch, runGuarded, guardDialog };
}
