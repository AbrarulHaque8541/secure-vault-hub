import { beforeEach, describe, expect, test } from "bun:test";
import {
  getVaultState,
  lockVault,
  subscribeToVault,
  unlockVault,
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
