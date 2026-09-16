import { useSyncExternalStore } from "react";

/**
 * Session-only vault key state. The derived passphrase is held in memory for
 * the lifetime of the tab and never persisted; a refresh locks the vault.
 */

interface VaultUnlockState {
  passphrase: string | null;
  unlockedAt: number | null;
}

let state: VaultUnlockState = { passphrase: null, unlockedAt: null };
const listeners = new Set<() => void>();

function setState(next: VaultUnlockState) {
  state = next;
  listeners.forEach((l) => l());
}

export function unlockVault(passphrase: string) {
  setState({ passphrase, unlockedAt: Date.now() });
}

export function lockVault() {
  setState({ passphrase: null, unlockedAt: null });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): VaultUnlockState {
  return state;
}

/** Read the vault state outside React (tests, imperative code). */
export function getVaultState(): VaultUnlockState {
  return getSnapshot();
}

/** Subscribe to vault state changes; returns an unsubscribe function. */
export function subscribeToVault(listener: () => void): () => void {
  return subscribe(listener);
}

export function useVaultUnlock(): VaultUnlockState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
