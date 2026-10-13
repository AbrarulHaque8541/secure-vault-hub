import { beforeEach, describe, expect, test } from "bun:test";
import {
  getAutoLockMs,
  getVaultState,
  isIdleExpired,
  lockVault,
  lockVaultIdle,
  noteActivity,
  setAutoLockMs,
  subscribeToVault,
  unlockVault,
  wasAutoLocked,
} from "./vault-store";

describe("vault unlock store", () => {
  beforeEach(() => {
    lockVault();
  });

  test("starts locked", () => {
    expect(getVaultState().passphrase).toBeNull();
    expect(getVaultState().unlockedAt).toBeNull();
  });

  test("unlock stores the passphrase and timestamp", () => {
    const before = Date.now();
    unlockVault("session key");
    const state = getVaultState();
    expect(state.passphrase).toBe("session key");
    expect(state.unlockedAt).not.toBeNull();
    expect(state.unlockedAt!).toBeGreaterThanOrEqual(before);
  });

  test("lock clears the key from memory", () => {
    unlockVault("session key");
    lockVault();
    expect(getVaultState().passphrase).toBeNull();
    expect(getVaultState().unlockedAt).toBeNull();
  });

  test("re-locking replaces a previous session key", () => {
    unlockVault("first");
    unlockVault("second");
    expect(getVaultState().passphrase).toBe("second");
  });

  test("notifies subscribers on unlock and lock", () => {
    const events: string[] = [];
    const unsubscribe = subscribeToVault(() => {
      events.push(getVaultState().passphrase ?? "locked");
    });

    unlockVault("k1");
    lockVault();
    unsubscribe();
    unlockVault("k2"); // no notification after unsubscribe

    expect(events).toEqual(["k1", "locked"]);
    expect(getVaultState().passphrase).toBe("k2");
  });
});

/**
 * Auto-lock is security behaviour, so it is tested as a pure predicate rather
 * than through fake timers: `isIdleExpired(now)` takes "now" as an argument,
 * which makes the policy deterministic and keeps these tests fast.
 */
describe("idle auto-lock policy", () => {
  beforeEach(() => {
    lockVault();
    setAutoLockMs(5 * 60 * 1000);
  });

  test("a freshly unlocked vault is not idle", () => {
    setAutoLockMs(5_000);
    unlockVault("correct horse");
    expect(isIdleExpired()).toBe(false);
  });

  test("does not expire one millisecond before the deadline", () => {
    setAutoLockMs(1_000);
    unlockVault("key");
    noteActivity(10_000);
    expect(isIdleExpired(10_999)).toBe(false);
  });

  test("expires exactly at the deadline", () => {
    setAutoLockMs(1_000);
    unlockVault("key");
    noteActivity(10_000);
    expect(isIdleExpired(11_000)).toBe(true);
  });

  test("activity pushes the deadline back", () => {
    setAutoLockMs(1_000);
    unlockVault("key");
    noteActivity(10_000);
    // Would have expired at 11_000, but the user typed at 10_900.
    noteActivity(10_900);
    expect(isIdleExpired(11_500)).toBe(false);
    expect(isIdleExpired(11_900)).toBe(true);
  });

  test("a locked vault is never idle", () => {
    setAutoLockMs(1);
    unlockVault("key");
    noteActivity(10_000);
    lockVault();
    // There is nothing left to lock, so the predicate must stay quiet.
    expect(isIdleExpired(999_999)).toBe(false);
  });

  test("auto-lock can be disabled with 0", () => {
    setAutoLockMs(0);
    unlockVault("key");
    noteActivity(1);
    expect(isIdleExpired(10_000_000)).toBe(false);
  });

  test("falls back to the default for an invalid window", () => {
    setAutoLockMs(0);
    expect(getAutoLockMs()).toBe(0);
    setAutoLockMs(Number.NaN);
    expect(getAutoLockMs()).toBe(5 * 60 * 1000);
    setAutoLockMs(-1);
    expect(getAutoLockMs()).toBe(5 * 60 * 1000);
  });

  test("an unset activity clock is not treated as idle", () => {
    // Guards the `lastActivityAt === 0` sentinel: reading an unset clock as
    // "idle since the epoch" would lock the vault the instant it opened.
    setAutoLockMs(1_000);
    unlockVault("key");
    noteActivity(0);
    expect(isIdleExpired(Date.now())).toBe(false);
  });

  test("the lock window is just long enough to be useful and short enough to matter", () => {
    expect(getAutoLockMs()).toBe(5 * 60 * 1000);
  });
});

/**
 * The lock reason is what lets the UI say "locked automatically after
 * inactivity" instead of appearing to lose the user's work. It also proves the
 * idle path is distinct from a deliberate lock.
 */
describe("auto-lock reason", () => {
  beforeEach(() => {
    lockVault();
    setAutoLockMs(5 * 60 * 1000);
  });

  test("a deliberate lock is not reported as an auto-lock", () => {
    unlockVault("key");
    lockVault();
    expect(wasAutoLocked()).toBe(false);
    expect(getVaultState().autoLockedAt).toBeNull();
  });

  test("an idle lock records when it happened", () => {
    unlockVault("key");
    lockVaultIdle(12_345);
    expect(wasAutoLocked()).toBe(true);
    expect(getVaultState().autoLockedAt).toBe(12_345);
    expect(getVaultState().passphrase).toBeNull();
  });

  test("unlocking clears a previous auto-lock reason", () => {
    unlockVault("key");
    lockVaultIdle(1);
    unlockVault("key");
    expect(wasAutoLocked()).toBe(false);
  });

  test("an idle lock clears the activity clock so it cannot re-fire", () => {
    setAutoLockMs(1_000);
    unlockVault("key");
    noteActivity(10_000);
    lockVaultIdle(11_000);
    // Nothing left to lock, so the predicate must stay quiet afterwards.
    expect(isIdleExpired(999_999)).toBe(false);
  });
});
