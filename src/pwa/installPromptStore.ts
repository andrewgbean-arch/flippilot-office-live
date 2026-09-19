// Keeps the browser's "this app can be installed" signal until someone wants it.
//
// Chrome, Edge and Samsung Internet on Android fire a "beforeinstallprompt"
// event once the app qualifies, usually seconds after the page loads and long
// before any card is on screen. If nothing is listening at that moment the
// event is lost, so main.tsx starts this store before the app renders. The
// event is kept (and its own pop-up held back with preventDefault) so that the
// Install app button can open the browser's install dialog later, from a tap.
//
// A browser lets one event be used once, so prompt() spends it. "appinstalled"
// fires when the app has been installed, and there is nothing left to offer.

export type PromptOutcome = "accepted" | "dismissed" | "unavailable";

// What Chromium adds to the event.
export interface BeforeInstallPromptEventLike extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export interface InstallPromptStore {
  start(target: Pick<EventTarget, "addEventListener" | "removeEventListener">): void;
  stop(): void;
  isAvailable(): boolean;
  subscribe(listener: () => void): () => void;
  prompt(): Promise<PromptOutcome>;
}

// The functions use the closure, never `this`, so they can be handed to
// React's useSyncExternalStore as they are.
export function createInstallPromptStore(): InstallPromptStore {
  let captured: BeforeInstallPromptEventLike | null = null;
  let detach: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    start(target) {
      if (detach) return;
      const onPrompt = (event: Event) => {
        event.preventDefault();
        captured = event as BeforeInstallPromptEventLike;
        notify();
      };
      const onInstalled = () => {
        captured = null;
        notify();
      };
      target.addEventListener("beforeinstallprompt", onPrompt);
      target.addEventListener("appinstalled", onInstalled);
      detach = () => {
        target.removeEventListener("beforeinstallprompt", onPrompt);
        target.removeEventListener("appinstalled", onInstalled);
      };
    },

    stop() {
      detach?.();
      detach = null;
      captured = null;
      notify();
    },

    isAvailable() {
      return captured !== null;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    // Call straight from the button's tap: a browser only opens its install
    // dialog for a real tap, so prompt() is called before anything is awaited.
    async prompt() {
      const event = captured;
      if (!event) return "unavailable";
      captured = null; // spent, whatever happens next
      notify();
      try {
        await event.prompt();
        const choice = await event.userChoice;
        return choice.outcome === "accepted" ? "accepted" : "dismissed";
      } catch {
        return "unavailable";
      }
    },
  };
}

// The one the app uses.
export const installPromptStore = createInstallPromptStore();

// Called once from main.tsx, before the app renders.
export function startInstallPromptCapture(): void {
  if (typeof window !== "undefined") installPromptStore.start(window);
}
