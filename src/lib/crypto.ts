import { bytesToBase64, base64ToBytes } from "./base64";

/**
 * AES-256-GCM envelope encryption for the local vault.
 *
 * The passphrase never leaves the device: we derive a 256-bit key with
 * PBKDF2-SHA256 (210k iterations, per OWASP 2023 guidance) and wrap the
 * random per-vault content key. Ciphertexts live in Convex only as opaque
 * base64 blobs.
 */

export const PBKDF2_ITERATIONS = 210_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface EncryptedPayload {
  v: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64
}

async function deriveKeyWithIterations(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  return deriveKeyWithIterations(passphrase, salt, PBKDF2_ITERATIONS);
}

export async function encryptString(plaintext: string, passphrase: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(plaintext),
  );
  return {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ct)),
  };
}

export async function decryptString(payload: EncryptedPayload, passphrase: string): Promise<string> {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = await deriveKey(passphrase, salt);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    base64ToBytes(payload.ct) as BufferSource,
  );
  return dec.decode(pt);
}

export function isVaultError(err: unknown): err is Error {
  return err instanceof Error && err.name === "OperationError";
}

/**
 * Accepted band for a persisted payload's iteration count.
 *
 * `EncryptedPayload.iterations` arrives from the datastore and is therefore
 * attacker-controlled: a stored `iterations: 4_000_000_000` would wedge the
 * tab inside PBKDF2 for minutes — a free denial of service. Anything outside a
 * generous band around the current parameter is refused instead of derived.
 */
export const MIN_ACCEPTED_ITERATIONS = 100_000;
export const MAX_ACCEPTED_ITERATIONS = 1_000_000;

/** Hard ceiling on ciphertext length, so a huge blob cannot exhaust memory. */
const MAX_CIPHERTEXT_BYTES = 1_000_000;

/**
 * `decryptString` for values that came from the datastore: the payload's own
 * KDF parameters are validated before any key derivation happens.
 *
 * Use `decryptString` for payloads this tab just produced; use this one for
 * anything that was persisted, received, or restored from a backup.
 */
export async function decryptStringWithinBudget(
  payload: EncryptedPayload,
  passphrase: string,
): Promise<string> {
  if (!payload || typeof payload !== "object") {
    throw new Error("Malformed encrypted payload");
  }
  if (payload.kdf !== "PBKDF2-SHA256") {
    throw new Error(`Unsupported key derivation: ${String(payload.kdf)}`);
  }
  const { iterations } = payload;
  if (
    !Number.isInteger(iterations) ||
    iterations < MIN_ACCEPTED_ITERATIONS ||
    iterations > MAX_ACCEPTED_ITERATIONS
  ) {
    throw new Error(
      `Refusing to derive a key with ${String(iterations)} iterations`,
    );
  }
  if (
    typeof payload.salt !== "string" ||
    typeof payload.iv !== "string" ||
    typeof payload.ct !== "string" ||
    payload.salt.length === 0 ||
    payload.iv.length === 0 ||
    payload.ct.length === 0
  ) {
    throw new Error("Malformed encrypted payload");
  }

  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const ct = base64ToBytes(payload.ct);
  // 16 bytes is the AES-GCM tag alone, so this is the true lower bound.
  if (ct.byteLength < 16 || ct.byteLength > MAX_CIPHERTEXT_BYTES) {
    throw new Error("Encrypted payload has an implausible length");
  }

  const key = await deriveKeyWithIterations(passphrase, salt, iterations);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return dec.decode(pt);
}
