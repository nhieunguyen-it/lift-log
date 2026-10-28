import { useId, useRef, useState } from 'react';
import HelpButton from '@/components/guide/HelpButton';
import ImportPassphraseDialog from '@/components/backup/ImportPassphraseDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PROFILES } from '@/config/profiles';
import {
  backup,
  profileImport,
  profiles,
  useActiveProfileName,
  useProfiles,
  validateProfileName,
  type Profile,
} from '@/db';
import type { Backup, EncryptedBackupEnvelope } from '@/db/backup';
import { BackupCryptoError, decryptBackup, isEncryptedEnvelope } from '@/db/backupCrypto';
import { cn } from '@/lib/utils';
import ProfileNameForm from './ProfileNameForm';
import { avatarClass, formatLastUsed, initialsOf } from './profileColors';
import { useProfileSwitch } from './useProfileSwitch';

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export default function ProfileManager() {
  const uid = useId();
  const activeName = useActiveProfileName();
  const all = useProfiles();
  const { requestSwitch, runGuarded, guardDialog } = useProfileSwitch();
  const fileRef = useRef<HTMLInputElement>(null);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Profile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const [encrypted, setEncrypted] = useState<EncryptedBackupEnvelope | null>(null);
  const [importing, setImporting] = useState<Backup | null>(null);
  const [importName, setImportName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const list = all ?? [];
  const atMax = list.length >= PROFILES.max;

  async function submitRename(p: Profile) {
    const check = validateProfileName(renameValue, list, p.id);
    if (!check.ok) {
      setRenameError(check.error);
      return;
    }
    try {
      await profiles.renameProfile(p.id, check.name);
      setRenamingId(null);
      // The active profile's name is bound at page load; reload so every label agrees.
      if (p.name === activeName) window.location.reload();
    } catch (e) {
      setRenameError(errText(e, 'Could not rename the profile.'));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await profiles.deleteProfile(deleting.id);
      setDeleting(null);
      setError(null);
    } catch (e) {
      setDeleting(null);
      setError(errText(e, 'Could not delete the profile.'));
    }
  }

  async function startImportWith(data: Backup) {
    setImportName(await profileImport.defaultImportName(data));
    setImportError(null);
    setImporting(data);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    if (fileRef.current) fileRef.current.value = '';
    setError(null);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      raw = undefined;
    }
    if (isEncryptedEnvelope(raw)) {
      setEncrypted(raw);
      return;
    }
    const res = backup.parseBackup(text);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await startImportWith(res.data);
  }

  async function decryptSelected(pass: string): Promise<string | null> {
    if (!encrypted) return null;
    try {
      const res = backup.parseBackup(await decryptBackup(encrypted, pass));
      if (!res.ok) return res.error;
      setEncrypted(null);
      await startImportWith(res.data);
      return null;
    } catch (e) {
      return e instanceof BackupCryptoError ? e.message : 'Could not decrypt this file.';
    }
  }

  function confirmImport() {
    if (!importing) return;
    const check = validateProfileName(importName, list);
    if (!check.ok) {
      setImportError(check.error);
      return;
    }
    const data = importing;
    runGuarded(async () => {
      try {
        await profileImport.importIntoNewProfile(data, check.name);
        window.location.reload();
      } catch (e) {
        console.error(e);
        setImportError(errText(e, 'Import failed. Your data was not changed.'));
      }
    });
  }

  return (
    <section id="profiles" aria-labelledby={`${uid}-h`} className="space-y-3">
      <div className="flex items-center gap-1">
        <h2 id={`${uid}-h`} className="text-lg font-medium">
          Profiles
        </h2>
        <HelpButton anchor="profiles-create" label="profiles" />
      </div>
      <p className="text-sm">
        Current profile: <span className="font-medium">{activeName}</span>
      </p>
      <p className="text-muted-foreground text-sm">
        Profiles keep data separate on this device. They are not a security feature: anyone using
        this browser can open any profile.
      </p>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {list.map((p) => {
          const isActive = p.name === activeName;
          const onlyOne = list.length <= 1;
          const renaming = renamingId === p.id;
          return (
            <li key={p.id} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-3">
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
              </div>

              {renaming ? (
                <form
                  className="space-y-2"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitRename(p);
                  }}
                >
                  <label htmlFor={`${uid}-r-${p.id}`} className="text-sm font-medium">
                    Profile name
                  </label>
                  <Input
                    id={`${uid}-r-${p.id}`}
                    data-testid="profile-rename-input"
                    value={renameValue}
                    maxLength={PROFILES.nameMaxLength}
                    autoComplete="off"
                    aria-invalid={renameError !== null}
                    onChange={(e) => {
                      setRenameValue(e.target.value);
                      setRenameError(null);
                    }}
                  />
                  {renameError && (
                    <p role="alert" className="text-destructive text-sm">
                      {renameError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" data-testid="profile-rename-save">
                      Save name
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setRenamingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {!isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`profile-switch-${p.id}`}
                      aria-label={`Switch to ${p.name}`}
                      onClick={() => requestSwitch(p.id)}
                    >
                      Switch
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="profile-rename"
                    aria-label={`Rename ${p.name}`}
                    onClick={() => {
                      setRenamingId(p.id);
                      setRenameValue(p.name);
                      setRenameError(null);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="profile-delete"
                    aria-label={`Delete ${p.name}`}
                    disabled={isActive || onlyOne}
                    onClick={() => {
                      setDeleting(p);
                      setDeleteConfirm('');
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
              {!renaming && (isActive || onlyOne) && (
                <p className="text-muted-foreground text-xs">
                  {onlyOne
                    ? 'The only profile cannot be deleted.'
                    : 'The active profile cannot be deleted. Switch to another profile first.'}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {creating ? (
        <ProfileNameForm
          existing={list}
          onCreated={(p) => {
            setCreating(false);
            requestSwitch(p.id);
          }}
        />
      ) : (
        <Button
          variant="outline"
          data-testid="profile-new"
          disabled={!all || atMax}
          onClick={() => setCreating(true)}
        >
          New profile
        </Button>
      )}
      {atMax && (
        <p className="text-muted-foreground text-xs">
          You can have at most {PROFILES.max} profiles.
        </p>
      )}

      <div>
        <Button
          variant="outline"
          data-testid="profile-import-new"
          disabled={!all || atMax}
          onClick={() => fileRef.current?.click()}
        >
          Import backup into a new profile
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="profile-import-file"
          aria-label="Backup file to import into a new profile"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>

      {guardDialog}

      <ImportPassphraseDialog
        open={encrypted !== null}
        onSubmit={decryptSelected}
        onCancel={() => setEncrypted(null)}
      />

      <Dialog open={importing !== null} onOpenChange={(o) => !o && setImporting(null)}>
        <DialogContent data-testid="profile-import-dialog">
          <DialogHeader>
            <DialogTitle>Import into a new profile</DialogTitle>
            <DialogDescription>
              This creates a new profile with {importing?.sessions.length ?? 0} workouts and{' '}
              {importing?.sets.length ?? 0} sets from the file. Your current data is not changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor={`${uid}-imp`} className="text-sm font-medium">
              Profile name
            </label>
            <Input
              id={`${uid}-imp`}
              data-testid="profile-import-name"
              value={importName}
              maxLength={PROFILES.nameMaxLength}
              autoComplete="off"
              onChange={(e) => {
                setImportName(e.target.value);
                setImportError(null);
              }}
            />
            {importError && (
              <p role="alert" className="text-destructive text-sm">
                {importError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button data-testid="profile-import-confirm" onClick={confirmImport}>
              Import and switch
            </Button>
            <Button variant="outline" onClick={() => setImporting(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete profile?</DialogTitle>
            <DialogDescription>
              This permanently deletes {deleting?.name} and all of its workouts, programs and
              settings. This cannot be undone. To keep a copy, switch to that profile and export a
              backup from Settings first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor={`${uid}-del`} className="text-sm font-medium">
              Type {deleting?.name} to confirm
            </label>
            <Input
              id={`${uid}-del`}
              data-testid="profile-delete-confirm-input"
              value={deleteConfirm}
              autoComplete="off"
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              data-testid="profile-delete-confirm"
              disabled={deleting === null || deleteConfirm !== deleting.name}
              onClick={() => void confirmDelete()}
            >
              Delete profile
            </Button>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
