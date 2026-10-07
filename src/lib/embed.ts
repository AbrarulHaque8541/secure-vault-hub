/**
 * Trust rules for the page's embed/iframe channel.
 *
 * The dashboard is designed to be framed (the preview host embeds it), so it
 * exchanges `postMessage` traffic with its parent. Both directions used to be
 * unchecked:
 *
 *   - outbound: `postMessage(payload, "*")` — the browser then delivers the
 *     message to whatever origin the frame happens to be nested in;
 *   - inbound: `if (event.data?.type === "navigate")` — the origin and the
 *     sender were ignored entirely, so ANY document that could obtain a handle
 *     to this window (a third-party frame, an opener, an injected ad iframe)
 *     could drive the router.
 *
 * Navigation sounds harmless, but a hostile sender can steer a signed-in user
 * to `/dashboard` or away from it, and the same "trust any sender" habit is
 * exactly what turns a later, richer message type into a real vulnerability.
 *
 * These helpers are pure so the policy is unit-testable without a browser.
 */

/** Parse a comma-separated allowlist from build configuration. */
export function parseAllowedOrigins(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    // Normalise away a trailing slash so `https://a.example/` and
    // `https://a.example` are not treated as two different origins.
    .map((entry) => entry.replace(/\/+$/, ""))
    .filter((entry, index, all) => all.indexOf(entry) === index);
}

function normaliseOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/**
 * Choose the target origin for our outbound route-change notification.
 *
 * A concrete origin beats `"*"` because `"*"` hands the message to every
 * ancestor frame. We can only name a concrete origin when exactly one is
 * allowlisted: with several, the correct target is whichever one actually
 * embedded us, and that is only discoverable from `document.referrer`.
 *
 * `"*"` remains the fallback, and that is a deliberate, narrow concession: the
 * payload is a pathname and nothing else. It must never carry a token, a
 * title, or anything derived from vault content.
 */
export function resolvePostTargetOrigin(
  allowedOrigins: string[],
  referrer: string,
): string {
  if (allowedOrigins.length === 1) return allowedOrigins[0];

  if (referrer) {
    try {
      const referrerOrigin = normaliseOrigin(new URL(referrer).origin);
      if (allowedOrigins.includes(referrerOrigin)) return referrerOrigin;
    } catch {
      // An unparseable or relative referrer tells us nothing — fall through.
    }
  }

  return "*";
}

export type NavigationDirection = "back" | "forward";

interface NavigationEnvelope {
  origin: string;
  isFromParent: boolean;
  data: unknown;
}

/**
 * Validate an inbound navigation request.
 *
 * Returns the requested direction, or `null` when the message must be ignored.
 * Every condition is required:
 *
 *   1. the payload is an object with `type === "navigate"`;
 *   2. the sender is the parent frame — a sibling or opened window that can
 *      reach us must not be able to drive the router;
 *   3. the sender's origin is allowlisted. An empty allowlist therefore
 *      denies everything: a missing configuration must fail closed rather
 *      than silently trusting all origins.
 *   4. `direction` is one of the two known values — an unknown string is not
 *      passed through to `history`.
 */
export function readNavigationDirection(
  message: NavigationEnvelope,
  allowedOrigins: string[],
): NavigationDirection | null {
  if (!message.isFromParent) return null;

  if (allowedOrigins.length === 0) return null;
  const origin = normaliseOrigin(message.origin);
  if (!origin) return null;
  if (!allowedOrigins.some((allowed) => normaliseOrigin(allowed) === origin)) {
    return null;
  }

  const { data } = message;
  if (typeof data !== "object" || data === null) return null;
  if ((data as { type?: unknown }).type !== "navigate") return null;

  const direction = (data as { direction?: unknown }).direction;
  if (direction === "back" || direction === "forward") return direction;
  return null;
}
