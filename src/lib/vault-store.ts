import { useEffect, useSyncExternalStore } from "react";

/**
 * Session-only vault key state. The derived passphrase is held in memory for
 * the lifetime of the tab and never persisted; a refresh locks the vault.
 *
 * ## Auto-lock
 *
 * A vault that stays unlocked until the tab is closed is a vault that stays
 * unlocked on a shared machine. This module owns the idle policy so the UI
 * cannot get it subtly wrong.
 *
 * Two design choices matter:
 *
 * 1. **Idle, not elapsed.** The old behaviour was a fixed window from
 *    `unlockedAt`, so the vault locked mid-use five minutes after unlocking
 *    and never locked at all during heavy use. Idleness is what actually
 *    corresponds to "the user walked away".
 * 2. **A polling check plus a visibility check, not a single long timeout.**
 *    Browsers throttle timers in background tabs, so a 5-minute
 *    `setTimeout` may fire minutes late — or only when the tab is focused
 *    again. Polling on a short interval keeps the remaining time honest, and
 *    the `visibilitychange` handler closes the window where the tab was
 *    hidden the whole time.
 *
 * ## Why the lock is armed here and not in a page
 *
 * `useAutoLock` used to be mounted inside `Dashboard`, which meant the vault
 * was only ever armed while `/dashboard` was on screen. Navigating to any
 * other route (or a future one) left the key in memory with no idle timer at
 * all — the exact gap the feature exists to close. The hook is now mounted
 * once, app-wide, in `main.tsx`, so every route is covered by construction.
 * The store also records *why* the vault locked (`autoLockedAt`) so a page can
 * explain the lock without owning the policy.
 */

interface VaultUnlockState {
  passphrase: string | null;
  unlockedAt: number | null;
  /**
   * When the vault locked itself because of inactivity, or `null` when it is
   * unlocked or was locked deliberately. Lets the UI say "locked automatically
   * after inactivity" without the page having to run the timer.
   */
  autoLockedAt: number | null;
}

/** Default idle window before the vault locks itself. */
export const DEFAULT_AUTO_LOCK_MS = 5 * 60 * 1000;

/** How often the idle check runs. Short enough to be honest, cheap enough to ignore. */
const AUTO_LOCK_POLL_MS = 1_000;

let state: VaultUnlockState = {
  passphrase: null,
  unlockedAt: null,
  autoLockedAt: null,
};
let lastActivityAt = 0;
let autoLockMs = DEFAULT_AUTO_LOCK_MS;

const listeners = new Set<() => void>();

function setState(next: VaultUnlockState) {
  state = next;
  listeners.forEach((l) => l());
}

/** Record user activity. Called from the input listeners and from tests. */
export function noteActivity(now = Date.now()) {
  lastActivityAt = now;
}

/** Configure the idle window. `0` disables auto-lock (used by tests). */
export function setAutoLockMs(ms: number) {
  autoLockMs = Number.isFinite(ms) && ms >= 0 ? ms : DEFAULT_AUTO_LOCK_MS;
}

export function getAutoLockMs(): number {
  return autoLockMs;
}

export function getLastActivityAt(): number {
  return lastActivityAt;
}

/**
 * Pure idle predicate, so the policy is testable without timers.
 *
 * Returns false when auto-lock is disabled, when the vault is locked, or when
 * activity has been seen within the window.
 */
export function isIdleExpired(now = Date.now()): boolean {
  if (autoLockMs === 0) return false;
  if (state.passphrase === null) return false;
  if (lastActivityAt === 0) return false;
  return now - lastActivityAt >= autoLockMs;
}

export function unlockVault(passphrase: string) {
  noteActivity();
  setState({ passphrase, unlockedAt: Date.now(), autoLockedAt: null });
}

/** Lock deliberately (sign-out, manual lock). Not an inactivity lock. */
export function lockVault() {
  lastActivityAt = 0;
  setState({ passphrase: null, unlockedAt: null, autoLockedAt: null });
}

/**
 * Lock because the idle window elapsed.
 *
 * Kept distinct from `lockVault` so the UI can tell the user *why* the screen
 * locked — a silent lock looks like lost work.
 */
export function lockVaultIdle(now = Date.now()) {
  lastActivityAt = 0;
  setState({ passphrase: null, unlockedAt: null, autoLockedAt: now });
}

/** True when the last lock was an inactivity lock. */
export function wasAutoLocked(): boolean {
  return state.autoLockedAt !== null;
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

/** Activity events that count as "the user is still here". */
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
];

/**
 * Arm the idle auto-lock. Mount this ONCE, app-wide (see `main.tsx`), so every
 * route is covered — mounting it inside a single page leaves the vault
 * unarmed everywhere else.
 *
 * @param onAutoLock Called when the vault locks itself, so the UI can explain
 *   why the screen just locked instead of appearing to lose the user's work.
 */
export function useAutoLock(onAutoLock?: () => void) {
  const { passphrase } = useVaultUnlock();

  useEffect(() => {
    if (!passphrase) return;

    // Activity resets the idle clock. `pointerdown`/`keydown` cover real
    // input; `wheel` and `touchstart` cover scrolling on mouse and touch.
    const mark = () => noteActivity();
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, mark, { passive: true }),
    );

    // Returning to a tab that was hidden past the deadline must lock
    // immediately — the poll below may have been throttled while hidden.
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (isIdleExpired()) {
        lockVaultIdle();
        onAutoLock?.();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const poll = window.setInterval(() => {
      if (isIdleExpired()) {
        lockVaultIdle();
        onAutoLock?.();
      }
    }, AUTO_LOCK_POLL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, mark),
      );
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(poll);
    };
  }, [passphrase, onAutoLock]);
}
