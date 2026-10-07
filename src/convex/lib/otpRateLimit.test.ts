import { describe, expect, test } from "bun:test";
import {
  BURST_MAX,
  BURST_WINDOW_MS,
  checkOtpRateLimit,
  normaliseIdentifier,
  pruneAttempts,
  rateLimitMessage,
  SUSTAINED_MAX,
  SUSTAINED_WINDOW_MS,
} from "./otpRateLimit";

const NOW = 1_700_000_000_000;

describe("checkOtpRateLimit — burst window", () => {
  test("allows the first request", () => {
    expect(checkOtpRateLimit([], NOW).allowed).toBe(true);
  });

  test("allows up to the burst allowance", () => {
    const attempts = Array.from({ length: BURST_MAX - 1 }, (_, i) => NOW - i * 1000);
    expect(checkOtpRateLimit(attempts, NOW).allowed).toBe(true);
  });

  test("denies the request that would exceed the burst allowance", () => {
    const attempts = Array.from({ length: BURST_MAX }, (_, i) => NOW - i * 1000);
    const decision = checkOtpRateLimit(attempts, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("burst");
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });

  test("a burst attempt exactly at the window edge has aged out", () => {
    const attempts = Array.from(
      { length: BURST_MAX },
      () => NOW - BURST_WINDOW_MS,
    );
    // `now - t < BURST_WINDOW_MS` is false at exactly the edge, so these no
    // longer count against the burst limit.
    expect(checkOtpRateLimit(attempts, NOW).allowed).toBe(true);
  });

  test("one millisecond inside the window still counts", () => {
    const attempts = Array.from(
      { length: BURST_MAX },
      () => NOW - BURST_WINDOW_MS + 1,
    );
    expect(checkOtpRateLimit(attempts, NOW).allowed).toBe(false);
  });
});

describe("checkOtpRateLimit — sustained window", () => {
  test("denies once the sustained allowance is reached", () => {
    // Spread the attempts so the burst limit is never the one that fires.
    const attempts = Array.from(
      { length: SUSTAINED_MAX },
      (_, i) => NOW - (i + 1) * (BURST_WINDOW_MS + 1),
    );
    const decision = checkOtpRateLimit(attempts, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("sustained");
  });

  test("attempts older than the sustained window do not count", () => {
    const attempts = Array.from(
      { length: SUSTAINED_MAX },
      () => NOW - SUSTAINED_WINDOW_MS,
    );
    expect(checkOtpRateLimit(attempts, NOW).allowed).toBe(true);
  });

  test("the burst limit is reported when both would fire", () => {
    const attempts = Array.from({ length: SUSTAINED_MAX }, (_, i) => NOW - i * 100);
    expect(checkOtpRateLimit(attempts, NOW).reason).toBe("burst");
  });
});

describe("pruneAttempts", () => {
  test("drops attempts outside the longest window", () => {
    const attempts = [NOW - SUSTAINED_WINDOW_MS - 1, NOW - 1000, NOW];
    expect(pruneAttempts(attempts, NOW)).toEqual([NOW - 1000, NOW]);
  });

  test("keeps everything inside the window", () => {
    const attempts = [NOW - 1000, NOW - 2000];
    expect(pruneAttempts(attempts, NOW)).toHaveLength(2);
  });
});

describe("normaliseIdentifier", () => {
  test("lowercases and trims so case cannot bypass the limit", () => {
    expect(normaliseIdentifier("  Alice@Example.COM ")).toBe("alice@example.com");
  });

  test("two spellings of the same address share a bucket", () => {
    expect(normaliseIdentifier("A@x.com")).toBe(normaliseIdentifier("a@x.com"));
  });
});

describe("rateLimitMessage", () => {
  test("is empty when the request is allowed", () => {
    expect(rateLimitMessage(checkOtpRateLimit([], NOW))).toBe("");
  });

  test("names a sub-minute wait in seconds", () => {
    // 30 s into the burst window, so the wait is 30 s — under a minute.
    const attempts = Array.from({ length: BURST_MAX }, () => NOW - 30_000);
    const message = rateLimitMessage(checkOtpRateLimit(attempts, NOW));
    expect(message).toContain("seconds");
  });

  test("names a wait of exactly a minute as a minute", () => {
    const attempts = Array.from({ length: BURST_MAX }, () => NOW);
    const message = rateLimitMessage(checkOtpRateLimit(attempts, NOW));
    expect(message).toContain("a minute");
  });

  test("names a long wait in minutes", () => {
    const attempts = Array.from(
      { length: SUSTAINED_MAX },
      (_, i) => NOW - (i + 1) * (BURST_WINDOW_MS + 1),
    );
    const message = rateLimitMessage(checkOtpRateLimit(attempts, NOW));
    expect(message).toContain("minutes");
  });
});
