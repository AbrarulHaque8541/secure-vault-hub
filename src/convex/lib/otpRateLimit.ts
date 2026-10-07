/**
 * Rate-limit policy for one-time-passcode requests, as pure functions.
 *
 * ## Why this exists
 *
 * The email OTP is a **6-digit** code valid for **15 minutes**, and the repo
 * had no rate limit of any kind. Six digits is 10^6 possibilities; at a few
 * hundred requests per second an attacker who can reach the verification
 * endpoint has a realistic chance of guessing a live code well inside its
 * lifetime. The code length is fixed by the provider, so the control that
 * actually closes the gap is bounding how many attempts an identifier may make.
 *
 * ## Design
 *
 * Two independent limits, because they stop different attacks:
 *
 *   - **Burst** — a short window with a small allowance. Stops a script that
 *     hammers the endpoint.
 *   - **Sustained** — a long window with a larger allowance. Stops a patient
 *     attacker who stays just under the burst limit for hours.
 *
 * The policy is a pure function of `(attempt timestamps, now)`, so every
 * boundary is testable without a clock, a database, or a timer.
 */

/** Short window: at most `BURST_MAX` requests per `BURST_WINDOW_MS`. */
export const BURST_WINDOW_MS = 60_000;
export const BURST_MAX = 3;

/** Long window: at most `SUSTAINED_MAX` requests per `SUSTAINED_WINDOW_MS`. */
export const SUSTAINED_WINDOW_MS = 60 * 60_000;
export const SUSTAINED_MAX = 10;

export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds the caller should wait before retrying; 0 when allowed. */
  retryAfterSeconds: number;
  /** Which limit was hit, for logging and for the user-facing message. */
  reason: "burst" | "sustained" | null;
}

const ALLOWED: RateLimitDecision = {
  allowed: false,
  retryAfterSeconds: 0,
  reason: null,
};

/**
 * Decide whether a new request from `identifier` may proceed.
 *
 * @param attempts Timestamps (ms) of previous requests, in any order.
 * @param now      Current time in ms.
 */
export function checkOtpRateLimit(
  attempts: number[],
  now: number,
): RateLimitDecision {
  const inBurst = attempts.filter((t) => now - t < BURST_WINDOW_MS);
  if (inBurst.length >= BURST_MAX) {
    const oldest = Math.min(...inBurst);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((BURST_WINDOW_MS - (now - oldest)) / 1000),
      ),
      reason: "burst",
    };
  }

  const inSustained = attempts.filter((t) => now - t < SUSTAINED_WINDOW_MS);
  if (inSustained.length >= SUSTAINED_MAX) {
    const oldest = Math.min(...inSustained);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((SUSTAINED_WINDOW_MS - (now - oldest)) / 1000),
      ),
      reason: "sustained",
    };
  }

  return { allowed: true, retryAfterSeconds: 0, reason: null };
}

/**
 * Drop attempts that have aged out of the longest window.
 *
 * Without this the stored history grows without bound for a busy identifier.
 */
export function pruneAttempts(attempts: number[], now: number): number[] {
  return attempts.filter((t) => now - t < SUSTAINED_WINDOW_MS);
}

/**
 * Normalise an identifier before it is used as a rate-limit key.
 *
 * Email addresses are case-insensitive in practice, so `A@x.com` and `a@x.com`
 * must share a bucket — otherwise the limit is trivially bypassed by changing
 * the case of one letter.
 */
export function normaliseIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

/** User-facing message for a denied request. */
export function rateLimitMessage(decision: RateLimitDecision): string {
  if (decision.allowed) return "";
  const minutes = Math.ceil(decision.retryAfterSeconds / 60);
  const wait =
    decision.retryAfterSeconds < 60
      ? `${decision.retryAfterSeconds} seconds`
      : minutes === 1
        ? "a minute"
        : `${minutes} minutes`;
  return `Too many code requests. Try again in ${wait}.`;
}

export { ALLOWED as OTP_ALLOWED };
