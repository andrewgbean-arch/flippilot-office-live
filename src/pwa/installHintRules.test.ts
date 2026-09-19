import { describe, it, expect } from "vitest";
import {
  INSTALL_HINT_DISMISSED_KEY,
  IOS_INSTALL_STEPS,
  createInstallHintDismissal,
  decideInstallHint,
  isIosDevice,
  isIosSafari,
  isPhoneOrTablet,
  isRunningStandalone,
  readBrowserInstallState,
  type BrowserWindowLike,
  type InstallEnvironment,
  type StorageLike,
} from "./installHintRules";

// Real user agent strings, so the platform checks are tested against what the
// browsers really send.
const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15",
  iphoneEdge:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/121.2277.107 Mobile/15E148 Safari/605.1.15",
  iphoneInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.12.108 (iPhone14,5; iOS 17_4; en_GB; en-GB; scale=3.00; 1170x2532; 558789431)",
  ipadSafari:
    "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  // An iPad set to "request desktop website" (the default since iPadOS 13) sends a Mac's.
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.99 Mobile Safari/537.36",
  androidEdge:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.99 Mobile Safari/537.36 EdgA/123.0.2420.89",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
};

const env = (userAgent: string, extra: Partial<InstallEnvironment> = {}): InstallEnvironment => ({ userAgent, ...extra });
const IPAD_DESKTOP_MODE = env(UA.macSafari, { platform: "MacIntel", maxTouchPoints: 5 });
const REAL_MAC = env(UA.macSafari, { platform: "MacIntel", maxTouchPoints: 0 });

describe("telling iPhone and iPad Safari from every other browser", () => {
  it("knows iPhone and iPad Safari, including an iPad in desktop-website mode", () => {
    expect(isIosSafari(env(UA.iphoneSafari))).toBe(true);
    expect(isIosSafari(env(UA.ipadSafari))).toBe(true);
    expect(isIosSafari(IPAD_DESKTOP_MODE)).toBe(true);
  });

  it("does not take Chrome, Firefox or Edge on an iPhone for Safari", () => {
    expect(isIosDevice(env(UA.iphoneChrome))).toBe(true);
    expect(isIosSafari(env(UA.iphoneChrome))).toBe(false);
    expect(isIosSafari(env(UA.iphoneFirefox))).toBe(false);
    expect(isIosSafari(env(UA.iphoneEdge))).toBe(false);
  });

  it("does not take an app's built-in browser for Safari", () => {
    expect(isIosDevice(env(UA.iphoneInstagram))).toBe(true);
    expect(isIosSafari(env(UA.iphoneInstagram))).toBe(false);
  });

  it("does not take a Mac, Android or Windows for an iPhone", () => {
    expect(isIosDevice(REAL_MAC)).toBe(false);
    expect(isIosSafari(REAL_MAC)).toBe(false);
    expect(isIosSafari(env(UA.androidChrome))).toBe(false);
    expect(isIosSafari(env(UA.windowsChrome))).toBe(false);
  });
});

describe("phone or tablet", () => {
  it("is yes for iPhone, iPad (either mode) and Android, in any browser", () => {
    for (const each of [
      env(UA.iphoneSafari),
      env(UA.iphoneChrome),
      env(UA.ipadSafari),
      IPAD_DESKTOP_MODE,
      env(UA.androidChrome),
      env(UA.androidEdge),
      env(UA.androidFirefox),
    ]) {
      expect(isPhoneOrTablet(each), each.userAgent).toBe(true);
    }
  });

  it("is no for a Mac or a Windows computer", () => {
    expect(isPhoneOrTablet(REAL_MAC)).toBe(false);
    expect(isPhoneOrTablet(env(UA.windowsChrome))).toBe(false);
  });
});

describe("already running from the home screen", () => {
  it("is yes when the display-mode query says standalone (Chrome, Android)", () => {
    expect(isRunningStandalone({ matchMedia: () => ({ matches: true }) })).toBe(true);
  });

  it("is yes when the iPhone says navigator.standalone", () => {
    expect(isRunningStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } })).toBe(true);
    expect(isRunningStandalone({ navigator: { standalone: true } })).toBe(true);
  });

  it("is no in an ordinary browser tab", () => {
    expect(isRunningStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: false } })).toBe(false);
    expect(isRunningStandalone({ matchMedia: () => ({ matches: false }), navigator: {} })).toBe(false);
    expect(isRunningStandalone({})).toBe(false);
  });

  it("does not fall over on a browser whose matchMedia throws", () => {
    const throws = () => {
      throw new Error("no matchMedia");
    };
    expect(isRunningStandalone({ matchMedia: throws })).toBe(false);
    expect(isRunningStandalone({ matchMedia: throws, navigator: { standalone: true } })).toBe(true);
  });
});

describe("reading the real browser", () => {
  function fakeWindow(userAgent: string, over: { standalone?: boolean; displayStandalone?: boolean } = {}) {
    const win = {
      navigator: { userAgent, platform: "iPhone", maxTouchPoints: 5, standalone: over.standalone },
      // like the real one, only works when called on the window itself
      matchMedia(this: unknown, query: string) {
        if (this !== win) throw new TypeError("Illegal invocation");
        return { matches: query === "(display-mode: standalone)" && over.displayStandalone === true };
      },
    };
    return win as BrowserWindowLike;
  }

  it("returns the user agent, and whether it is running from the home screen", () => {
    const browser = readBrowserInstallState(fakeWindow(UA.iphoneSafari));
    expect(browser.env.userAgent).toBe(UA.iphoneSafari);
    expect(browser.env.platform).toBe("iPhone");
    expect(browser.env.maxTouchPoints).toBe(5);
    expect(browser.standalone).toBe(false);
  });

  it("sees standalone through either signal", () => {
    expect(readBrowserInstallState(fakeWindow(UA.iphoneSafari, { standalone: true })).standalone).toBe(true);
    expect(readBrowserInstallState(fakeWindow(UA.androidChrome, { displayStandalone: true })).standalone).toBe(true);
  });

  it("gives an empty, not-installed answer where there is no window at all (or reading it throws)", () => {
    expect(readBrowserInstallState(undefined).standalone).toBe(false);
    const hostile = {
      get navigator(): BrowserWindowLike["navigator"] {
        throw new Error("blocked");
      },
    } as unknown as BrowserWindowLike;
    expect(readBrowserInstallState(hostile)).toEqual({ env: { userAgent: "" }, standalone: false });
  });
});

describe("whether to show the card, and which one", () => {
  const show = (
    environment: InstallEnvironment,
    over: { standalone?: boolean; dismissed?: boolean; installPromptAvailable?: boolean } = {}
  ) =>
    decideInstallHint({
      env: environment,
      standalone: false,
      dismissed: false,
      installPromptAvailable: false,
      ...over,
    });

  it("shows the two taps on iPhone and iPad Safari (they have no install button to press)", () => {
    expect(show(env(UA.iphoneSafari))).toBe("ios-steps");
    expect(show(env(UA.ipadSafari))).toBe("ios-steps");
    expect(show(IPAD_DESKTOP_MODE)).toBe("ios-steps");
  });

  it("shows an Install app button on Android once the browser has said the app can be installed", () => {
    expect(show(env(UA.androidChrome), { installPromptAvailable: true })).toBe("install-button");
    expect(show(env(UA.androidEdge), { installPromptAvailable: true })).toBe("install-button");
  });

  it("shows nothing on Android until the browser has said so (Firefox never does)", () => {
    expect(show(env(UA.androidChrome))).toBe("none");
    expect(show(env(UA.androidFirefox))).toBe("none");
  });

  it("shows nothing in Chrome or Firefox on an iPhone", () => {
    expect(show(env(UA.iphoneChrome))).toBe("none");
    expect(show(env(UA.iphoneChrome), { installPromptAvailable: true })).toBe("none");
    expect(show(env(UA.iphoneFirefox))).toBe("none");
  });

  it("shows nothing on a computer, even where the browser offers to install", () => {
    expect(show(env(UA.windowsChrome), { installPromptAvailable: true })).toBe("none");
    expect(show(REAL_MAC)).toBe("none");
    expect(show(env(""))).toBe("none");
  });

  it("shows nothing when the app is already running from the home screen", () => {
    expect(show(env(UA.iphoneSafari), { standalone: true })).toBe("none");
    expect(show(env(UA.androidChrome), { standalone: true, installPromptAvailable: true })).toBe("none");
  });

  it("shows nothing once it has been dismissed", () => {
    expect(show(env(UA.iphoneSafari), { dismissed: true })).toBe("none");
    expect(show(env(UA.androidChrome), { dismissed: true, installPromptAvailable: true })).toBe("none");
  });
});

describe("the steps shown on an iPhone", () => {
  it("say to tap the Share button, then Add to Home Screen", () => {
    expect(IOS_INSTALL_STEPS).toHaveLength(2);
    expect(IOS_INSTALL_STEPS[0]).toMatch(/tap the share button/i);
    expect(IOS_INSTALL_STEPS[1]).toContain('"Add to Home Screen"');
  });
});

describe("remembering a dismissal", () => {
  function memoryStorage(): StorageLike & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
    };
  }

  it("is not dismissed to begin with, then is, and stays so on the next visit", () => {
    const storage = memoryStorage();
    const firstVisit = createInstallHintDismissal(() => storage);
    expect(firstVisit.isDismissed()).toBe(false);
    firstVisit.dismiss();
    expect(firstVisit.isDismissed()).toBe(true);
    expect(storage.data.get(INSTALL_HINT_DISMISSED_KEY)).toBe("1");
    // a new page load: a new object over the same storage
    expect(createInstallHintDismissal(() => storage).isDismissed()).toBe(true);
  });

  it("does not treat some other stored value as a dismissal", () => {
    const storage = memoryStorage();
    storage.setItem(INSTALL_HINT_DISMISSED_KEY, "0");
    expect(createInstallHintDismissal(() => storage).isDismissed()).toBe(false);
  });

  it("copes with storage that refuses to be read or written, and still stays away for the rest of the visit", () => {
    const refusing: StorageLike = {
      getItem() {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem() {
        throw new DOMException("quota", "QuotaExceededError");
      },
    };
    const dismissal = createInstallHintDismissal(() => refusing);
    expect(dismissal.isDismissed()).toBe(false);
    expect(() => dismissal.dismiss()).not.toThrow();
    expect(dismissal.isDismissed()).toBe(true);
  });

  it("copes with there being no storage at all, or getting it throwing", () => {
    const none = createInstallHintDismissal(() => null);
    expect(none.isDismissed()).toBe(false);
    expect(() => none.dismiss()).not.toThrow();
    expect(none.isDismissed()).toBe(true);

    const blocked = createInstallHintDismissal(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(blocked.isDismissed()).toBe(false);
    expect(() => blocked.dismiss()).not.toThrow();
    expect(blocked.isDismissed()).toBe(true);
  });

  it("uses the browser's storage by default, and copes where there is none", () => {
    // no window in this test run, which is what a blocked browser looks like to the code
    const standard = createInstallHintDismissal();
    expect(standard.isDismissed()).toBe(false);
    expect(() => standard.dismiss()).not.toThrow();
  });
});
