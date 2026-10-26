import { useRef, useState } from 'react';
import { ChevronRight, Download, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import HelpButton from '@/components/guide/HelpButton';
import EquipmentSettings from '@/components/recommend/EquipmentSettings';
import TrainingSettings from '@/components/analyze/TrainingSettings';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ExportPassphraseFields, {
  validatePassphrase,
} from '@/components/backup/ExportPassphraseFields';
import ImportPassphraseDialog from '@/components/backup/ImportPassphraseDialog';
import { backup, settingsRepo, useUnit } from '@/db';
import {
  BackupCryptoError,
  decryptBackup,
  encryptBackup,
  isEncryptedEnvelope,
} from '@/db/backupCrypto';
import type { Backup, EncryptedBackupEnvelope } from '@/db/backup';
import type { WeightUnit } from '@/lib/units';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const unit = useUnit();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const [passphrase, setPassphrase] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [encrypted, setEncrypted] = useState<EncryptedBackupEnvelope | null>(null);

  async function doExport() {
    const err = validatePassphrase(passphrase, confirmPass);
    setPassError(err);
    if (err) return;
    const data = await backup.exportData();
    const json = JSON.stringify(data, null, 2);
    const payload = passphrase
      ? JSON.stringify(await encryptBackup(json, passphrase), null, 2)
      : json;
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lift-log-${new Date().toISOString().slice(0, 10)}${passphrase ? '-encrypted' : ''}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage({
      kind: 'ok',
      text: passphrase ? 'Encrypted export downloaded.' : 'Export downloaded.',
    });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    if (fileRef.current) fileRef.current.value = '';
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      raw = undefined;
    }
    if (isEncryptedEnvelope(raw)) {
      setPending(null);
      setMessage(null);
      setEncrypted(raw);
      return;
    }
    const res = backup.parseBackup(text);
    if (!res.ok) {
      setPending(null);
      setMessage({ kind: 'error', text: res.error });
      return;
    }
    setMessage(null);
    setPending(res.data);
  }

  async function decryptSelected(pass: string): Promise<string | null> {
    if (!encrypted) return null;
    try {
      const res = backup.parseBackup(await decryptBackup(encrypted, pass));
      if (!res.ok) return res.error;
      setEncrypted(null);
      setMessage(null);
      setPending(res.data);
      return null;
    } catch (e) {
      return e instanceof BackupCryptoError ? e.message : 'Could not decrypt this file.';
    }
  }

  async function confirmImport() {
    if (!pending) return;
    await backup.importData(pending);
    setPending(null);
    setMessage({ kind: 'ok', text: 'Import complete. Your data was replaced.' });
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-1">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <HelpButton anchor="settings" label="settings" />
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Weight unit</h2>
        <div role="group" aria-label="Weight unit" className="grid grid-cols-2 gap-2">
          {(['kg', 'lbs'] as WeightUnit[]).map((u) => (
            <Button
              key={u}
              variant={unit === u ? 'default' : 'outline'}
              aria-pressed={unit === u}
              data-testid={`unit-${u}`}
              onClick={() => void settingsRepo.setUnit(u)}
              className={cn('w-full')}
            >
              {u}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Weights are stored in kg and converted for display (rounded to 0.5 kg / 1 lb).
        </p>
      </div>

      <TrainingSettings />

      <section className="space-y-2" aria-labelledby="equipment-heading">
        <h2 id="equipment-heading" className="text-lg font-medium">
          My equipment
        </h2>
        <p className="text-muted-foreground text-sm">
          Suggestions and swaps only use exercises you can do with this equipment.
        </p>
        <EquipmentSettings />
      </section>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Your data</h2>
        <ExportPassphraseFields
          passphrase={passphrase}
          confirm={confirmPass}
          onPassphrase={setPassphrase}
          onConfirm={setConfirmPass}
          error={passError}
        />
        <Button
          variant="outline"
          className="w-full"
          data-testid="export-json"
          onClick={() => void doExport()}
        >
          <Download /> Export JSON
        </Button>
        <Button
          variant="outline"
          className="w-full"
          data-testid="import-button"
          onClick={() => fileRef.current?.click()}
        >
          <Upload /> Import JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Import JSON file"
          data-testid="import-file"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            data-testid="settings-message"
            className={cn(
              'text-sm',
              message.kind === 'error' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {message.text}
          </p>
        )}
      </div>

      <Card className="p-4">
        <Link
          to="/guide"
          data-testid="settings-guide-link"
          className="flex min-h-11 items-center justify-between gap-2 font-medium"
        >
          <span>
            Guide
            <span className="text-muted-foreground block text-sm font-normal">
              How Lift Log works, searchable and offline
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      </Card>

      <div className="space-y-1">
        <h2 className="text-lg font-medium">About</h2>
        <p className="text-muted-foreground text-sm">
          Suggestions are general training heuristics, not medical advice.
        </p>
      </div>

      <ImportPassphraseDialog
        open={encrypted !== null}
        onSubmit={decryptSelected}
        onCancel={() => setEncrypted(null)}
      />

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent data-testid="import-dialog">
          <DialogHeader>
            <DialogTitle>Replace all data?</DialogTitle>
            <DialogDescription>
              This replaces your current workouts with {pending?.sessions.length ?? 0} workouts and{' '}
              {pending?.sets.length ?? 0} sets from the file. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" data-testid="import-confirm" onClick={confirmImport}>
              Replace data
            </Button>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
