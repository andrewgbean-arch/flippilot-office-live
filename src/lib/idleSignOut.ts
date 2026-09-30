// Automatic sign-out when nobody is using Dealer OS (IdleSignOut.tsx).
//
// A computer left signed in on the showroom floor or in the workshop can be
// used by whoever walks up to it. So after the owner's chosen quiet time (15
// minutes unless they change it in Settings; they can also turn it off) with
// no mouse, keyboard or touch, the app signs out. A minute before, it asks
// "Still there?", and any movement keeps you in.
//
// "Last used" is shared by every Dealer OS tab in the browser (localStorage),
// so working in one tab keeps the others signed in too, and a tab someone
// closes and reopens later is still held to the time since it was last used.

export const DEFAULT_AUTO_SIGN_OUT_MINUTES = 15;
// What the owner can choose in Settings (0 = never). Same list as the server's
// AUTO_SIGN_OUT_CHOICES.
export const AUTO_SIGN_OUT_CHOICES = [15, 30, 60, 0] as const;
export const WARNING_MS = 60_000;

const LAST_USED_KEY = "flippilot_last_used_at";
// Set just before an automatic sign-out, so the sign-in page can say why.
const SIGNED_OUT_KEY = "flippilot_signed_out_idle_minutes";

/** The quiet time the dealership's setting means, in minutes; null = never sign out. */
export function autoSignOutMinutes(setting: unknown): number | null {
  if (setting === 0) return null;
  return typeof setting === "number" && (AUTO_SIGN_OUT_CHOICES as readonly number[]).includes(setting)
    ? setting
    : DEFAULT_AUTO_SIGN_OUT_MINUTES;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function localStore(): Store | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function sessionStore(): Store | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

/** Someone is using Dealer OS right now (or has just signed in). */
export function recordUse(now = Date.now(), store: Store | null = localStore()): void {
  try {
    store?.setItem(LAST_USED_KEY, String(now));
  } catch {
    // Storage unavailable: this tab still counts its own use (createIdleWatcher).
  }
}

function lastRecordedUse(store: Store | null): number | null {
  try {
    const n = Number(store?.getItem(LAST_USED_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export type IdleCheck =
  | { state: "in-use" }
  | { state: "warning"; msLeft: number }
  | { state: "sign-out" };

// Writing on every mouse movement would be pointless; the shared time is at
// most this far behind, which is nothing against a 15-minute limit.
const WRITE_EVERY_MS = 5_000;

/**
 * Tracks use for one tab against the shared "last used" time. `use()` on any
 * mouse, keyboard or touch; `check()` on a timer.
 */
export function createIdleWatcher(limitMs: number, clock: () => number = Date.now, store: Store | null = localStore()) {
  // First time this browser has seen the feature: start counting from now.
  let mine = lastRecordedUse(store) ?? clock();
  let written = 0;
  if (lastRecordedUse(store) === null) {
    recordUse(mine, store);
    written = mine;
  }
  return {
    use() {
      mine = clock();
      if (mine - written >= WRITE_EVERY_MS) {
        recordUse(mine, store);
        written = mine;
      }
    },
    check(): IdleCheck {
      const last = Math.max(mine, lastRecordedUse(store) ?? 0);
      const quiet = clock() - last;
      if (quiet >= limitMs) return { state: "sign-out" };
      if (quiet >= limitMs - WARNING_MS) return { state: "warning", msLeft: limitMs - quiet };
      return { state: "in-use" };
    },
  };
}

/** Called just before an automatic sign-out, for the sign-in page's note. */
export function rememberIdleSignOut(minutes: number, store: Store | null = sessionStore()): void {
  try {
    store?.setItem(SIGNED_OUT_KEY, String(minutes));
  } catch {
    // The note is a nicety; signing out doesn't depend on it.
  }
}

/** The sign-in page's note after an automatic sign-out, or null. Shown once: see clearIdleSignOutNote. */
export function idleSignOutNote(store: Store | null = sessionStore()): string | null {
  try {
    const minutes = Number(store?.getItem(SIGNED_OUT_KEY));
    if (!Number.isFinite(minutes) || minutes <= 0) return null;
    return `You were signed out because Dealer OS wasn't used for ${minutes} minutes. Sign in again to carry on.`;
  } catch {
    return null;
  }
}

export function clearIdleSignOutNote(store: Store | null = sessionStore()): void {
  try {
    store?.removeItem(SIGNED_OUT_KEY);
  } catch {
    // Nothing to clear.
  }
}
