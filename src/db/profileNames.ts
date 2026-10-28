import { PROFILES } from '@/config/profiles';

export type NameCheck = { ok: true; name: string } | { ok: false; error: string };

// Letters, digits, space, underscore and hyphen (any script).
const ALLOWED = /^[\p{L}\p{M}\p{N} _-]+$/u;

export interface NameCandidate {
  id: string;
  name: string;
}

/**
 * Pure validation of a profile name. `existing` is every profile; pass `selfId` when renaming
 * so a profile can keep (or re-case) its own name.
 */
export function validateProfileName(
  raw: string,
  existing: NameCandidate[],
  selfId?: string,
): NameCheck {
  const name = raw.normalize('NFC').trim();
  if (name.length < PROFILES.nameMinLength) return { ok: false, error: 'Enter a name.' };
  if (name.length > PROFILES.nameMaxLength) {
    return { ok: false, error: `Use at most ${PROFILES.nameMaxLength} characters.` };
  }
  if (!ALLOWED.test(name)) {
    return { ok: false, error: 'Use letters, digits, spaces, _ and - only.' };
  }
  const lower = name.toLowerCase();
  if (existing.some((p) => p.id !== selfId && p.name.toLowerCase() === lower)) {
    return { ok: false, error: 'A profile with this name already exists.' };
  }
  if (selfId === undefined && existing.length >= PROFILES.max) {
    return { ok: false, error: `You can have at most ${PROFILES.max} profiles.` };
  }
  return { ok: true, name };
}

/** Default name for an imported backup: its profile name if valid and free, else a suffixed one. */
export function suggestImportName(raw: string | undefined, existing: NameCandidate[]): string {
  const base =
    (raw ?? 'Imported')
      .normalize('NFC')
      .replace(/[^\p{L}\p{M}\p{N} _-]/gu, '')
      .trim()
      .slice(0, PROFILES.nameMaxLength) || 'Imported';
  for (let i = 1; i < 100; i++) {
    const suffix = i === 1 ? '' : ` ${i}`;
    const cand = base.slice(0, PROFILES.nameMaxLength - suffix.length).trimEnd() + suffix;
    if (!existing.some((p) => p.name.toLowerCase() === cand.toLowerCase())) return cand;
  }
  return base;
}
