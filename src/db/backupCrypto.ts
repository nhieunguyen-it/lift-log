import { TRAINING } from '@/config/training';
import type { EncryptedBackupEnvelope } from './backup';

export type BackupCryptoErrorCode = 'wrong-passphrase' | 'invalid-envelope' | 'unsupported';

/** Typed error for encrypted backups; `wrong-passphrase` also covers tampered data. */
export class BackupCryptoError extends Error {
  readonly code: BackupCryptoErrorCode;
  constructor(code: BackupCryptoErrorCode, message: string) {
    super(message);
    this.name = 'BackupCryptoError';
    this.code = code;
  }
}

const SALT_BYTES = 16;
const IV_BYTES = 12;
const MAX_ITERATIONS = 10_000_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s)
    throw new BackupCryptoError('unsupported', 'Encryption is not supported in this browser.');
  return s;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const s = subtle();
  const base = await s.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return s.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypts backup JSON text with a passphrase into a self-describing envelope. */
export async function encryptBackup(
  json: string,
  passphrase: string,
  iterations = TRAINING.backup.pbkdf2Iterations,
): Promise<EncryptedBackupEnvelope> {
  if (!passphrase) throw new BackupCryptoError('invalid-envelope', 'A passphrase is required.');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, iterations);
  const cipher = await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(json));
  return {
    app: 'lift-log',
    format: 'lift-log-encrypted',
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(new Uint8Array(cipher)),
  };
}

/** True when parsed JSON looks like an encrypted Lift Log envelope. */
export function isEncryptedEnvelope(raw: unknown): raw is EncryptedBackupEnvelope {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return r.app === 'lift-log' && r.format === 'lift-log-encrypted';
}

function validateEnvelope(env: EncryptedBackupEnvelope): {
  salt: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  data: Uint8Array<ArrayBuffer>;
  iterations: number;
} {
  const bad = (m: string) =>
    new BackupCryptoError('invalid-envelope', `Invalid encrypted backup: ${m}`);
  if (env.version !== 1) throw bad('unsupported version.');
  if (env.kdf?.name !== 'PBKDF2' || env.kdf.hash !== 'SHA-256')
    throw bad('unsupported key derivation.');
  if (env.cipher?.name !== 'AES-GCM') throw bad('unsupported cipher.');
  const it = env.kdf.iterations;
  if (!Number.isInteger(it) || it < 1 || it > MAX_ITERATIONS) throw bad('bad iteration count.');
  try {
    return {
      salt: fromBase64(env.kdf.salt),
      iv: fromBase64(env.cipher.iv),
      data: fromBase64(env.data),
      iterations: it,
    };
  } catch {
    throw bad('data is not valid base64.');
  }
}

/** Decrypts to the plain backup JSON text. Throws BackupCryptoError; never writes anything. */
export async function decryptBackup(
  envelope: EncryptedBackupEnvelope,
  passphrase: string,
): Promise<string> {
  const { salt, iv, data, iterations } = validateEnvelope(envelope);
  if (iv.length !== IV_BYTES) {
    throw new BackupCryptoError('invalid-envelope', 'Invalid encrypted backup: bad IV.');
  }
  const key = await deriveKey(passphrase, salt, iterations);
  try {
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv }, key, data);
    return dec.decode(plain);
  } catch {
    throw new BackupCryptoError(
      'wrong-passphrase',
      'Wrong passphrase, or the file is damaged. Nothing was imported.',
    );
  }
}
