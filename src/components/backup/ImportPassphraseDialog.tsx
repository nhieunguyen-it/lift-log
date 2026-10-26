import { useId, useState } from 'react';
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

interface Props {
  open: boolean;
  /** Resolves with an error message to show, or null on success. */
  onSubmit: (passphrase: string) => Promise<string | null>;
  onCancel: () => void;
}

export default function ImportPassphraseDialog(props: Props) {
  // Mount the form only while open so its state starts fresh each time.
  return props.open ? <PassphraseForm {...props} /> : null;
}

function PassphraseForm({ open, onSubmit, onCancel }: Props) {
  const uid = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const err = await onSubmit(value);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="passphrase-dialog">
        <DialogHeader>
          <DialogTitle>Encrypted backup</DialogTitle>
          <DialogDescription>
            Enter the passphrase used when this file was exported. Nothing is imported until you
            confirm on the next step.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1">
            <label htmlFor={`${uid}-p`} className="text-sm font-medium">
              Passphrase
            </label>
            <Input
              id={`${uid}-p`}
              type="password"
              autoComplete="current-password"
              data-testid="import-passphrase"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          {error && (
            <p
              role="alert"
              data-testid="import-passphrase-error"
              className="text-destructive text-sm"
            >
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="submit"
              disabled={busy || value === ''}
              data-testid="import-passphrase-submit"
            >
              Decrypt
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
