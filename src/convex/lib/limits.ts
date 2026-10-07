/**
 * Vault size limits, shared by the three callers that must never disagree:
 * the Convex functions (server), the capture/edit UI (client), and the tests.
 *
 * They live inside the Convex functions directory because that is the only
 * path the Convex bundler resolves without configuration, and the client
 * imports them through the `@/convex/...` alias. Duplicating the numbers is
 * how a client and its server drift apart — one side then rejects what the
 * other happily produced.
 */

/** Max UTF-8 bytes for the encrypted body blob (~750 KB of base64 payload). */
export const MAX_CIPHERTEXT_BYTES = 1_000_000;

/** Max UTF-8 bytes for the encrypted title blob. */
export const MAX_ENCRYPTED_TITLE_BYTES = 8_192;

/** Max characters in a decrypted title. */
export const MAX_TITLE_CHARS = 120;

/** Max number of hint strings attached to one entry. */
export const MAX_HINTS = 10;

/** Max characters in a single hint string. */
export const MAX_HINT_CHARS = 200;

/** Max entries one account may store. */
export const MAX_ITEMS_PER_USER = 5_000;

/** Max characters in a decrypted entry body, enforced client-side (~100 KB). */
export const MAX_BODY_CHARS = 100_000;

const encoder = new TextEncoder();

export function utf8ByteLength(value: string): number {
  return encoder.encode(value).length;
}

/**
 * Truncate without splitting a surrogate pair.
 *
 * `String.prototype.slice` counts UTF-16 code units, so cutting a string that
 * ends in an emoji or other astral character can leave a lone surrogate behind
 * — which serialises to invalid UTF-8 and corrupts the stored value.
 */
function safeSlice(value: string, max: number): string {
  if (value.length <= max) return value;
  let end = max;
  const code = value.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return value.slice(0, end);
}

/**
 * Collapse whitespace and hard-truncate so a title stays one short line.
 * Applied on both sides of the wire: the client normalises before encrypting,
 * the server normalises whatever a direct API caller sends.
 */
export function normaliseTitle(input: string, max = MAX_TITLE_CHARS): string {
  const flat = input.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${safeSlice(flat, max - 1).trimEnd()}…`;
}

/** Bound a decrypted body before it is encrypted or rendered. */
export function clampBody(input: string, max = MAX_BODY_CHARS): string {
  return safeSlice(input, max);
}
