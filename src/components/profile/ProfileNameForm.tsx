import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PROFILES } from '@/config/profiles';
import { profiles, validateProfileName, type Profile } from '@/db';

/** Inline "new profile" form. Calls `onCreated` with the new profile. */
export default function ProfileNameForm({
  existing,
  onCreated,
}: {
  existing: Profile[];
  onCreated: (profile: Profile) => void;
}) {
  const uid = useId();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const check = validateProfileName(name, existing);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    try {
      onCreated(await profiles.createProfile(check.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the profile.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-2" noValidate>
      <label htmlFor={`${uid}-name`} className="text-sm font-medium">
        Profile name
      </label>
      <Input
        id={`${uid}-name`}
        data-testid="profile-name-input"
        value={name}
        maxLength={PROFILES.nameMaxLength}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        aria-invalid={error !== null}
        aria-describedby={error ? `${uid}-err` : undefined}
        autoComplete="off"
      />
      {error && (
        <p id={`${uid}-err`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" data-testid="profile-create" disabled={busy}>
        Create profile
      </Button>
    </form>
  );
}
