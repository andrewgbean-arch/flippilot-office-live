import { describe, it, expect, vi } from "vitest";
import { createInstallPromptStore, type BeforeInstallPromptEventLike } from "./installPromptStore";

// Chrome and Edge on Android announce "this app can be installed" once, soon
// after the page loads. The store keeps that announcement until the Install app
// button is tapped.

function promptEvent(outcome: "accepted" | "dismissed" | "throws" = "accepted") {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as BeforeInstallPromptEventLike;
  const calls = { prompt: 0 };
  event.prompt = () => {
    calls.prompt += 1;
    return outcome === "throws" ? Promise.reject(new DOMException("used", "InvalidStateError")) : Promise.resolve();
  };
  event.userChoice = Promise.resolve({ outcome: outcome === "throws" ? "dismissed" : outcome });
  return { event, calls };
}

describe("the install prompt store", () => {
  it("has nothing to offer until the browser announces the app can be installed", () => {
    const store = createInstallPromptStore();
    store.start(new EventTarget());
    expect(store.isAvailable()).toBe(false);
  });

  it("keeps the announcement, and holds back the browser's own pop-up so the button can open it later", () => {
    const store = createInstallPromptStore();
    const target = new EventTarget();
    store.start(target);
    const { event } = promptEvent();
    target.dispatchEvent(event);
    expect(store.isAvailable()).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("tells whoever is listening when it arrives and when it is gone, and stops when they leave", () => {
    const store = createInstallPromptStore();
    const target = new EventTarget();
    store.start(target);
    const heard = vi.fn();
    const leave = store.subscribe(heard);
    target.dispatchEvent(promptEvent().event);
    expect(heard).toHaveBeenCalledTimes(1);
    target.dispatchEvent(new Event("appinstalled"));
    expect(heard).toHaveBeenCalledTimes(2);
    leave();
    target.dispatchEvent(promptEvent().event);
    expect(heard).toHaveBeenCalledTimes(2);
    expect(store.isAvailable()).toBe(true);
  });

  it("opens the browser's install dialog when asked and reports what the person chose", async () => {
    for (const outcome of ["accepted", "dismissed"] as const) {
      const store = createInstallPromptStore();
      const target = new EventTarget();
      store.start(target);
      const { event, calls } = promptEvent(outcome);
      target.dispatchEvent(event);
      expect(await store.prompt()).toBe(outcome);
      expect(calls.prompt).toBe(1);
    }
  });

  it("opens the dialog straight away, before anything is awaited (a browser only allows it from a tap)", () => {
    const store = createInstallPromptStore();
    const target = new EventTarget();
    store.start(target);
    const { event, calls } = promptEvent();
    target.dispatchEvent(event);
    void store.prompt();
    expect(calls.prompt).toBe(1);
  });

  it("spends the announcement when it is used: a browser lets it be used once", async () => {
    const store = createInstallPromptStore();
    const target = new EventTarget();
    store.start(target);
    const { event, calls } = promptEvent();
    target.dispatchEvent(event);
    await store.prompt();
    expect(store.isAvailable()).toBe(false);
    expect(await store.prompt()).toBe("unavailable");
    expect(calls.prompt).toBe(1);
  });

  it("says unavailable, and spends it, if the browser refuses to open the dialog", async () => {
    const store = createInstallPromptStore();
    const target = new EventTarget();
    store.start(target);
    target.dispatchEvent(promptEvent("throws").event);
    expect(await store.prompt()).toBe("unavailable");
    expect(store.isAvailable()).toBe(false);
  });

  it("says unavailable when nothing was ever announced", async () => {
    expect(await createInstallPromptStore().prompt()).toBe("unavailable");
  });

  it("forgets it once the app has been installed", () => {
    const store = createInstallPromptStore();
    const target = new EventTarget();
    store.start(target);
    target.dispatchEvent(promptEvent().event);
    target.dispatchEvent(new Event("appinstalled"));
    expect(store.isAvailable()).toBe(false);
  });

  it("uses the newest announcement if the browser sends another", async () => {
    const store = createInstallPromptStore();
    const target = new EventTarget();
    store.start(target);
    const first = promptEvent();
    const second = promptEvent();
    target.dispatchEvent(first.event);
    target.dispatchEvent(second.event);
    await store.prompt();
    expect(first.calls.prompt).toBe(0);
    expect(second.calls.prompt).toBe(1);
  });

  it("listens only once however often it is started, and stops listening when stopped", () => {
    const store = createInstallPromptStore();
    const target = new EventTarget();
    const add = vi.spyOn(target, "addEventListener");
    store.start(target);
    store.start(target);
    expect(add).toHaveBeenCalledTimes(2); // beforeinstallprompt and appinstalled, once each
    store.stop();
    target.dispatchEvent(promptEvent().event);
    expect(store.isAvailable()).toBe(false);
  });

  it("hands its functions to React as they are, without needing `this`", () => {
    const store = createInstallPromptStore();
    const { subscribe, isAvailable } = store;
    expect(() => subscribe(() => undefined)()).not.toThrow();
    expect(isAvailable()).toBe(false);
  });
});
