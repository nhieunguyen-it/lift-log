import { describe, expect, it } from 'vitest';
import { PROFILES } from '@/config/profiles';
import { suggestImportName, validateProfileName } from './profileNames';

const mk = (...names: string[]) => names.map((name, i) => ({ id: `id${i}`, name }));

describe('validateProfileName', () => {
  it('trims the name', () => {
    expect(validateProfileName('  Alex  ', [])).toEqual({ ok: true, name: 'Alex' });
  });

  it('rejects empty and whitespace-only names', () => {
    expect(validateProfileName('', []).ok).toBe(false);
    expect(validateProfileName('   ', []).ok).toBe(false);
  });

  it('enforces the configured length limits', () => {
    expect(validateProfileName('a'.repeat(PROFILES.nameMaxLength), []).ok).toBe(true);
    expect(validateProfileName('a'.repeat(PROFILES.nameMaxLength + 1), []).ok).toBe(false);
    expect(validateProfileName('a'.repeat(PROFILES.nameMinLength), []).ok).toBe(true);
    // Length is measured after trimming.
    expect(validateProfileName(` ${'a'.repeat(PROFILES.nameMaxLength)} `, []).ok).toBe(true);
  });

  it('is unique case-insensitively', () => {
    const existing = mk('Alex');
    expect(validateProfileName('alex', existing).ok).toBe(false);
    expect(validateProfileName(' ALEX ', existing).ok).toBe(false);
    expect(validateProfileName('Alexa', existing).ok).toBe(true);
  });

  it('enforces the configured maximum number of profiles', () => {
    const full = mk(...Array.from({ length: PROFILES.max }, (_, i) => `P${i}`));
    expect(validateProfileName('New', full).ok).toBe(false);
    expect(validateProfileName('New', full.slice(1)).ok).toBe(true);
    // Renaming is not blocked by the cap.
    expect(validateProfileName('Renamed', full, full[0].id).ok).toBe(true);
  });

  it('allows letters, digits, space, underscore and hyphen', () => {
    for (const ok of ['test_account', 'a-b', 'Gym 2', 'Zoë', 'Nguyễn 9']) {
      expect(validateProfileName(ok, []).ok, ok).toBe(true);
    }
  });

  it('rejects other characters and emoji', () => {
    for (const bad of ['a/b', 'a.b', 'x@y', 'lift💪', '<b>', 'a\\b', 'a\tb']) {
      expect(validateProfileName(bad, []).ok, bad).toBe(false);
    }
  });

  it('lets a profile keep or re-case its own name on rename', () => {
    const existing = mk('Alex', 'Sam');
    expect(validateProfileName('Alex', existing, 'id0')).toEqual({ ok: true, name: 'Alex' });
    expect(validateProfileName('ALEX', existing, 'id0')).toEqual({ ok: true, name: 'ALEX' });
    expect(validateProfileName('sam', existing, 'id0').ok).toBe(false);
  });
});

describe('suggestImportName', () => {
  it('uses the backup name when free', () => {
    expect(suggestImportName('Fixture Lifter', mk('Default'))).toBe('Fixture Lifter');
  });

  it('falls back to "Imported" when there is no name', () => {
    expect(suggestImportName(undefined, [])).toBe('Imported');
    expect(suggestImportName('💪💪', [])).toBe('Imported');
  });

  it('dedupes with a numeric suffix, case-insensitively', () => {
    expect(suggestImportName('Alex', mk('alex'))).toBe('Alex 2');
    expect(suggestImportName('Alex', mk('Alex', 'Alex 2'))).toBe('Alex 3');
  });

  it('strips invalid characters and respects the max length even with a suffix', () => {
    expect(suggestImportName('a/b', [])).toBe('ab');
    const long = 'x'.repeat(PROFILES.nameMaxLength + 10);
    const first = suggestImportName(long, []);
    expect(first).toHaveLength(PROFILES.nameMaxLength);
    const second = suggestImportName(long, mk(first));
    expect(second.length).toBeLessThanOrEqual(PROFILES.nameMaxLength);
    expect(second).not.toBe(first);
    expect(validateProfileName(second, mk(first)).ok).toBe(true);
  });
});
