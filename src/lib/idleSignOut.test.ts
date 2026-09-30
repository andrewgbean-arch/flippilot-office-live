import { describe, it, expect, afterEach, vi } from "vitest";
import {
  autoSignOutMinutes,
  createIdleWatcher,
  recordUse,
  rememberIdleSignOut,
  idleSignOutNote,
  clearIdleSignOutNote,
  WARNING_MS,
} from "./idleSignOut";
import { setAuthToken } from "./authToken";

// Automatic sign-out after the owner's chosen quiet time (15 minutes unless
// changed in Settings). A computer left signed in on the showroom floor can't
// be used by whoever walks up to it.

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const MIN = 60_000;

describe("the dealership's setting", () => {
  it("is 15 minutes unless the owner chose otherwise, and 0 means never", () => {
    expect(autoSignOutMinutes(undefined)).toBe(15);
    expect(autoSignOutMinutes(15)).toBe(15);
    expect(autoSignOutMinutes(30)).toBe(30);
    expect(autoSignOutMinutes(60)).toBe(60);
    expect(autoSignOutMinutes(0)).toBeNull();
  });

  it("anything that isn't one of the choices is the safe default, never 'never'", () => {
    for (const odd of [45, 1, -1, "0", "30", null, NaN, Infinity]) {
      expect(autoSignOutMinutes(odd), String(odd)).toBe(15);
    }
  });
});

describe("the watcher", () => {
  it("is quiet while in use, asks a minute before, and signs out at the limit", () => {
    let now = 1_000_000;
    const w = createIdleWatcher(15 * MIN, () => now, fakeStorage());
    expect(w.check()).toEqual({ state: "in-use" });

    now += 14 * MIN - 1;
    expect(w.check()).toEqual({ state: "in-use" });
    now += 1;
    expect(w.check()).toEqual({ state: "warning", msLeft: WARNING_MS });
    now += 30_000;
    expect(w.check()).toEqual({ state: "warning", msLeft: 30_000 });
    now += 30_000;
    expect(w.check()).toEqual({ state: "sign-out" });
  });

  it("any use starts the time again, even during the warning", () => {
    let now = 1_000_000;
    const w = createIdleWatcher(15 * MIN, () => now, fakeStorage());
    now += 14.5 * MIN;
    expect(w.check().state).toBe("warning");
    w.use();
    expect(w.check()).toEqual({ state: "in-use" });
    now += 14 * MIN;
    expect(w.check().state).toBe("warning");
  });

  it("uses a moment ago still count even though the shared time is only written every few seconds", () => {
    let now = 1_000_000;
    const store = fakeStorage();
    const w = createIdleWatcher(15 * MIN, () => now, store);
    now += 2_000;
    w.use(); // not written (too soon), but this tab knows
    now += 15 * MIN - 1_000;
    expect(w.check().state).not.toBe("sign-out");
  });

  it("working in another Dealer OS tab keeps this one signed in", () => {
    let now = 1_000_000;
    const store = fakeStorage();
    const quietTab = createIdleWatcher(15 * MIN, () => now, store);
    const busyTab = createIdleWatcher(15 * MIN, () => now, store);
    now += 10 * MIN;
    busyTab.use();
    now += 10 * MIN;
    expect(quietTab.check()).toEqual({ state: "in-use" });
  });

  it("a tab closed and opened again later is held to the time since it was last used", () => {
    let now = 1_000_000;
    const store = fakeStorage();
    recordUse(now, store);
    now += 20 * MIN;
    const reopened = createIdleWatcher(15 * MIN, () => now, store);
    expect(reopened.check()).toEqual({ state: "sign-out" });
  });

  it("the first time a browser sees this, it counts from now rather than signing out", () => {
    const now = 1_000_000;
    const store = fakeStorage();
    const w = createIdleWatcher(15 * MIN, () => now, store);
    expect(w.check()).toEqual({ state: "in-use" });
    expect(store.getItem("flippilot_last_used_at")).toBe(String(now));
  });

  it("a longer choice is honoured", () => {
    let now = 1_000_000;
    const w = createIdleWatcher(60 * MIN, () => now, fakeStorage());
    now += 50 * MIN;
    expect(w.check()).toEqual({ state: "in-use" });
    now += 10 * MIN;
    expect(w.check()).toEqual({ state: "sign-out" });
  });

  it("still works with no storage at all (private browsing that refuses it)", () => {
    let now = 1_000_000;
    const w = createIdleWatcher(15 * MIN, () => now, null);
    now += 10 * MIN;
    w.use();
    now += 10 * MIN;
    expect(w.check()).toEqual({ state: "in-use" });
    now += 5 * MIN;
    expect(w.check()).toEqual({ state: "sign-out" });
  });
});

describe("signing in counts as using it", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("so yesterday's quiet time can't sign you straight back out", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    store.setItem("flippilot_last_used_at", String(Date.now() - 24 * 60 * MIN));
    setAuthToken("new-login");
    const w = createIdleWatcher(15 * MIN, Date.now, store);
    expect(w.check()).toEqual({ state: "in-use" });
  });

  it("signing out doesn't count as use", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    setAuthToken(null);
    expect(store.getItem("flippilot_last_used_at")).toBeNull();
  });
});

describe("the note on the sign-in page", () => {
  it("says why, until the page clears it", () => {
    const store = fakeStorage();
    expect(idleSignOutNote(store)).toBeNull();
    rememberIdleSignOut(15, store);
    expect(idleSignOutNote(store)).toBe(
      "You were signed out because Dealer OS wasn't used for 15 minutes. Sign in again to carry on."
    );
    clearIdleSignOutNote(store);
    expect(idleSignOutNote(store)).toBeNull();
  });

  it("shows nothing for a value it didn't write", () => {
    const store = fakeStorage();
    for (const junk of ["", "0", "-5", "abc"]) {
      store.setItem("flippilot_signed_out_idle_minutes", junk);
      expect(idleSignOutNote(store), junk).toBeNull();
    }
  });
});
