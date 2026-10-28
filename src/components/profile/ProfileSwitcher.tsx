import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HelpButton from '@/components/guide/HelpButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PROFILES } from '@/config/profiles';
import { useActiveProfileName, useProfiles, type Profile } from '@/db';
import { cn } from '@/lib/utils';
import ProfileNameForm from './ProfileNameForm';
import { avatarClass, formatLastUsed, initialsOf } from './profileColors';
import { useProfileSwitch } from './useProfileSwitch';

export default function ProfileSwitcher({ className }: { className?: string }) {
  const navigate = useNavigate();
  const activeName = useActiveProfileName();
  const all = useProfiles();
  const { requestSwitch, guardDialog } = useProfileSwitch();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const active = all?.find((p) => p.name === activeName);
  const listed: Profile[] = (() => {
    if (!all) return [];
    const top = all.slice(0, PROFILES.switcherListSize);
    if (active && !top.includes(active)) top[top.length - 1] = active;
    return top;
  })();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setCreating(false);
  }

  function pick(id: string) {
    setOpen(false);
    requestSwitch(id);
  }

  return (
    <>
      <button
        type="button"
        data-testid="profile-switcher"
        aria-label={`Profile: ${activeName}. Switch profile`}
        onClick={() => setOpen(true)}
        className={cn(
          'focus-visible:ring-ring/50 flex size-11 items-center justify-center rounded-full text-sm font-semibold outline-none focus-visible:ring-[3px]',
          avatarClass(active?.color),
          className,
        )}
      >
        <span aria-hidden="true">{initialsOf(activeName)}</span>
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-testid="profile-sheet"
          className="top-auto bottom-0 left-0 max-h-[90dvh] max-w-full translate-x-0 translate-y-0 overflow-y-auto rounded-b-none sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[85dvh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-b-lg"
        >
          <DialogHeader>
            <div className="flex items-center gap-1 pr-10">
              <DialogTitle>Profiles</DialogTitle>
              <HelpButton anchor="profiles-switch" label="profiles" />
            </div>
            <DialogDescription>
              Profiles keep data separate on this device. They are not a security feature.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2">
            {listed.map((p) => {
              const isActive = p.name === activeName;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    data-testid={`profile-item-${p.id}`}
                    onClick={() => (isActive ? setOpen(false) : pick(p.id))}
                    className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-12 w-full items-center gap-3 rounded-md border p-2 text-left outline-none focus-visible:ring-[3px]"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                        avatarClass(p.color),
                      )}
                    >
                      {initialsOf(p.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="text-muted-foreground block text-xs">
                        Last used {formatLastUsed(p.lastUsedAt)}
                      </span>
                    </span>
                    {isActive && (
                      <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                        Active
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {creating ? (
            <ProfileNameForm
              existing={all ?? []}
              onCreated={(p) => {
                setOpen(false);
                setCreating(false);
                requestSwitch(p.id);
              }}
            />
          ) : (
            <Button
              variant="outline"
              data-testid="profile-new"
              onClick={() => setCreating(true)}
              disabled={!all}
            >
              New profile
            </Button>
          )}

          <Button
            variant="link"
            data-testid="profile-manage"
            onClick={() => {
              setOpen(false);
              void navigate('/settings#profiles');
            }}
          >
            Manage profiles
          </Button>
        </DialogContent>
      </Dialog>
      {guardDialog}
    </>
  );
}
