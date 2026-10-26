import { describe, expect, it } from 'vitest';
import { TRAINING } from '@/config/training';
import {
  BackupCryptoError,
  decryptBackup,
  encryptBackup,
  isEncryptedEnvelope,
} from './backupCrypto';

const FAST = 1000;
const json = JSON.stringify({ app: 'lift-log', hello: 'wörld ✓' });

describe('backupCrypto', () => {
  it('round-trips', async () => {
    const env = await encryptBackup(json, 'correct horse', FAST);
    expect(isEncryptedEnvelope(env)).toBe(true);
    expect(env.data).not.toContain('hello');
    expect(await decryptBackup(env, 'correct horse')).toBe(json);
  });

  it('uses fresh salt and iv, and the configured iteration count by default', async () => {
    const a = await encryptBackup(json, 'pw', FAST);
    const b = await encryptBackup(json, 'pw', FAST);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
    expect(atob(a.kdf.salt)).toHaveLength(16);
    expect(atob(a.cipher.iv)).toHaveLength(12);
    const d = await encryptBackup(json, 'pw');
    expect(d.kdf.iterations).toBe(TRAINING.backup.pbkdf2Iterations);
  }, 20_000);

  it('rejects a wrong passphrase with a typed error', async () => {
    const env = await encryptBackup(json, 'right', FAST);
    const err = await decryptBackup(env, 'wrong').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BackupCryptoError);
    expect((err as BackupCryptoError).code).toBe('wrong-passphrase');
    expect((err as Error).message).toMatch(/passphrase/i);
  });

  it('rejects tampered ciphertext', async () => {
    const env = await encryptBackup(json, 'pw', FAST);
    const bytes = Uint8Array.from(atob(env.data), (c) => c.charCodeAt(0));
    bytes[0] ^= 0xff;
    const tampered = { ...env, data: btoa(String.fromCharCode(...bytes)) };
    await expect(decryptBackup(tampered, 'pw')).rejects.toMatchObject({ code: 'wrong-passphrase' });
  });

  it('reads the iteration count from the file', async () => {
    const env = await encryptBackup(json, 'pw', FAST);
    expect(env.kdf.iterations).toBe(FAST);
    // Changing the stored count changes the derived key, so decryption fails.
    const other = { ...env, kdf: { ...env.kdf, iterations: FAST + 1 } };
    await expect(decryptBackup(other, 'pw')).rejects.toBeInstanceOf(BackupCryptoError);
  });

  it('rejects malformed envelopes', async () => {
    const env = await encryptBackup(json, 'pw', FAST);
    await expect(
      decryptBackup({ ...env, kdf: { ...env.kdf, iterations: -5 } }, 'pw'),
    ).rejects.toMatchObject({ code: 'invalid-envelope' });
    expect(isEncryptedEnvelope({ app: 'lift-log', version: 3 })).toBe(false);
    expect(isEncryptedEnvelope(null)).toBe(false);
  });
});
