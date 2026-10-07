import { bytesToBase64, base64ToBytes } from "./base64";

/**
 * AES-256-GCM envelope encryption for the local vault.
 *
 * The passphrase never leaves the device: we derive a 256-bit key with
 * PBKDF2-SHA256 (210k iterations, per OWASP 2023 guidance) and wrap the
 * random per-vault content key. Ciphertexts live in Convex only as opaque
 * base64 blobs.
 *
 * ## Two hardening changes over the original envelope
 *
 * 1. **Derived keys are cached** (see `deriveKeyWithIterations`). PBKDF2 at
 *    210k iterations costs ~25 ms, and the original code re-derived the key
 *    for *every* operation — so revealing a 20-card list spent half a second
 *    of main-thread-adjacent CPU re-deriving the same key 20 times. The cache
 *    is keyed by the full derivation input, so a different passphrase or salt
 *    can never collide with a cached key.
 *
 * 2. **Ciphertexts can be bound to their owner** via AES-GCM additional
 *    authenticated data (AAD). Without it, a malicious or compromised server
 *    can move a ciphertext blob from one account to another and the client
 *    will happily decrypt it — the tag only proves the bytes were not
 *    modified, not *where they belong*. Payloads written with an AAD are
 *    version 2; version 1 payloads (no AAD) still decrypt, so this is an
 *    expand-and-contract change rather than a flag day.
 */

export const PBKDF2_ITERATIONS = 210_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface EncryptedPayload {
  /**
   * Envelope version.
   *   1 — no additional authenticated data (legacy).
   *   2 — bound to an AAD; decryption requires the same AAD.
   */
  v: 1 | 2;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64
}

/**
 * The AAD that binds a vault ciphertext to the account that owns it.
 *
 * A server that swaps two users' ciphertext blobs is otherwise undetectable:
 * both decrypt cleanly under their own owner's key. Binding the account id
 * into the tag makes the swap fail authentication instead.
 *
 * Item-level binding (so a swap *within* one account also fails) needs the
 * item id before encryption, which the datastore only assigns on insert; that
 * requires a two-phase write and is deliberately left as a follow-up.
 */
export function vaultAad(userId: string): string {
  return `vault:v2:${userId}`;
}

/* ------------------------------ key derivation ---------------------------- */

/**
 * Cache of derived keys, keyed by the complete derivation input.
 *
 * The passphrase is already held in memory for the session, so caching the
 * derived key adds no new exposure — it only removes the repeated PBKDF2 cost.
 * Bounded so a pathological caller cannot grow it without limit.
 */
const keyCache = new Map<string, Promise<CryptoKey>>();
const MAX_CACHED_KEYS = 32;

function cacheKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): string {
  // `\u0000` cannot appear in a passphrase typed into a form, so it is a safe
  // separator between the three inputs.
  return `${iterations}\u0000${bytesToBase64(salt)}\u0000${passphrase}`;
}

/** Drop every cached key. Used by tests; also useful on an explicit lock. */
export function clearKeyCache(): void {
  keyCache.clear();
}

/** Number of keys currently cached. Exposed for tests. */
export function keyCacheSize(): number {
  return keyCache.size;
}

async function deriveKeyWithIterations(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const id = cacheKey(passphrase, salt, iterations);
  const cached = keyCache.get(id);
  if (cached) return cached;

  const pending = (async () => {
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
  })();

  // A failed derivation must not be cached, or every later attempt would
  // replay the same rejection.
  const guarded = pending.catch((err) => {
    keyCache.delete(id);
    throw err;
  });

  keyCache.set(id, guarded);
  if (keyCache.size > MAX_CACHED_KEYS) {
    const oldest = keyCache.keys().next().value;
    if (oldest !== undefined) keyCache.delete(oldest);
  }
  return guarded;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  return deriveKeyWithIterations(passphrase, salt, PBKDF2_ITERATIONS);
}

/* -------------------------------- encryption ------------------------------ */

function gcmParams(iv: Uint8Array, aad?: string): AesGcmParams {
  const params: AesGcmParams = { name: "AES-GCM", iv: iv as BufferSource };
  if (aad !== undefined) params.additionalData = enc.encode(aad);
  return params;
}

export async function encryptString(
  plaintext: string,
  passphrase: string,
  aad?: string,
): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt(
    gcmParams(iv, aad),
    key,
    enc.encode(plaintext),
  );
  return {
    v: aad === undefined ? 1 : 2,
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ct)),
  };
}

/**
 * Resolve the AAD a payload requires, or throw when it is missing.
 *
 * A version-2 payload decrypted without its AAD would fail authentication
 * anyway; failing here with a clear message is friendlier than an opaque
 * `OperationError` that the UI would report as "wrong key".
 */
function resolveAad(payload: EncryptedPayload, aad?: string): string | undefined {
  const version = payload.v ?? 1;
  if (version >= 2) {
    if (aad === undefined) {
      throw new Error(
        "This entry is bound to an account; the account id is required to decrypt it.",
      );
    }
    return aad;
  }
  return undefined;
}

export async function decryptString(
  payload: EncryptedPayload,
  passphrase: string,
  aad?: string,
): Promise<string> {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = await deriveKey(passphrase, salt);
  const pt = await crypto.subtle.decrypt(
    gcmParams(iv, resolveAad(payload, aad)),
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
  aad?: string,
): Promise<string> {
  if (!payload || typeof payload !== "object") {
    throw new Error("Malformed encrypted payload");
  }
  if (payload.kdf !== "PBKDF2-SHA256") {
    throw new Error(`Unsupported key derivation: ${String(payload.kdf)}`);
  }
  const version = payload.v ?? 1;
  if (version !== 1 && version !== 2) {
    throw new Error(`Unsupported envelope version: ${String(payload.v)}`);
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
    gcmParams(iv, resolveAad(payload, aad)),
    key,
    ct as BufferSource,
  );
  return dec.decode(pt);
}
