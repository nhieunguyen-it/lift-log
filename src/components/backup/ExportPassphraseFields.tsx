import { useId } from 'react';
import { Input } from '@/components/ui/input';

export const MIN_PASSPHRASE_LENGTH = 8;

/** Returns an error message, or null when the pair is acceptable (empty = no encryption). */
export function validatePassphrase(pass: string, confirm: string): string | null {
  if (pass === '' && confirm === '') return null;
  if (pass.length < MIN_PASSPHRASE_LENGTH) {
    return `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`;
  }
  if (pass !== confirm) return 'Passphrases do not match.';
  return null;
}

interface Props {
  passphrase: string;
  confirm: string;
  onPassphrase: (v: string) => void;
  onConfirm: (v: string) => void;
  error: string | null;
}

export default function ExportPassphraseFields({
  passphrase,
  confirm,
  onPassphrase,
  onConfirm,
  error,
}: Props) {
  const uid = useId();
  return (
    <div className="space-y-2" data-testid="export-passphrase-fields">
      <div className="space-y-1">
        <label htmlFor={`${uid}-p`} className="text-sm font-medium">
          Passphrase (optional)
        </label>
        <Input
          id={`${uid}-p`}
          type="password"
          autoComplete="new-password"
          data-testid="export-passphrase"
          value={passphrase}
          onChange={(e) => onPassphrase(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${uid}-c`} className="text-sm font-medium">
          Confirm passphrase
        </label>
        <Input
          id={`${uid}-c`}
          type="password"
          autoComplete="new-password"
          data-testid="export-passphrase-confirm"
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Leave empty for a plain JSON file. With a passphrase the file is encrypted on this device. A
        lost passphrase cannot be recovered, and the backup cannot be opened without it.
      </p>
      {error && (
        <p role="alert" data-testid="export-passphrase-error" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
