// The "put FlipPilot on your home screen" card: who is shown it and what it says.
//
// Everything that DECIDES is here as plain functions, so it can be tested
// without a browser. InstallHint.tsx only reads the browser and shows the result.
//
//  - Only on a phone or tablet, and only while the app is not already running
//    from the home screen.
//  - Chrome, Edge and Samsung Internet on Android announce when the app can be
//    installed (a "beforeinstallprompt" event, kept by installPromptStore.ts),
//    and the card then has an Install app button.
//  - iPhone and iPad Safari never announce it and have no install button to
//    press, so the card shows the two taps instead. Other iPhone browsers
//    (Chrome, Firefox...) and every computer get nothing.
//  - Once dismissed, it stays dismissed.

// ---- What the card says ------------------------------------------------------

export const INSTALL_HINT_TITLE = "Put FlipPilot on your home screen";
export const INSTALL_HINT_TEXT = "It opens like an app, full screen, with no browser bars.";
export const INSTALL_BUTTON_LABEL = "Install app";
export const IOS_INSTALL_STEPS = [
  "Tap the Share button (the square with an arrow pointing up).",
  'Choose "Add to Home Screen", then tap Add.',
] as const;

// ---- What kind of browser this is -------------------------------------------

export interface InstallEnvironment {
  userAgent: string;
  // navigator.platform and navigator.maxTouchPoints, which tell an iPad that
  // asks for desktop websites (and so calls itself a Mac) from a real Mac.
  platform?: string | undefined;
  maxTouchPoints?: number | undefined;
}

export function isIosDevice(env: InstallEnvironment): boolean {
  if (/iPhone|iPad|iPod/.test(env.userAgent)) return true;
  // Since iPadOS 13 an iPad's Safari says it is a Mac. A real Mac has no touch screen.
  return (/Macintosh/.test(env.userAgent) || env.platform === "MacIntel") && (env.maxTouchPoints ?? 0) > 1;
}

// Every browser on an iPhone is built on Safari's engine and adds its own name
// to the user agent. Only Safari itself has the Share button with Add to Home
// Screen that the card describes, so the others are left out. Safari's own user
// agent has both "Version/" and "Safari/"; an app's built-in browser lacks "Safari/".
const OTHER_IOS_BROWSERS = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|YaBrowser|UCBrowser|Focus\//;

export function isIosSafari(env: InstallEnvironment): boolean {
  if (!isIosDevice(env)) return false;
  if (OTHER_IOS_BROWSERS.test(env.userAgent)) return false;
  return /Version\//.test(env.userAgent) && /Safari\//.test(env.userAgent);
}

export function isPhoneOrTablet(env: InstallEnvironment): boolean {
  return isIosDevice(env) || /Android/i.test(env.userAgent);
}

// ---- Is it already installed? -----------------------------------------------

export interface StandaloneProbe {
  matchMedia?: ((query: string) => { matches: boolean }) | undefined;
  navigator?: { standalone?: boolean | undefined } | undefined;
}

// Running from the home screen: Chrome and Android say so through the
// display-mode media query, iPhone through navigator.standalone.
export function isRunningStandalone(probe: StandaloneProbe): boolean {
  try {
    if (probe.matchMedia?.("(display-mode: standalone)").matches === true) return true;
  } catch {
    // an odd browser without matchMedia: fall through to the iPhone check
  }
  return probe.navigator?.standalone === true;
}

// The parts of `window` that are read, so a stand-in can be used in tests.
export interface BrowserWindowLike {
  navigator: {
    userAgent: string;
    platform?: string | undefined;
    maxTouchPoints?: number | undefined;
    standalone?: boolean | undefined;
  };
  matchMedia?: ((query: string) => { matches: boolean }) | undefined;
}

export interface BrowserInstallState {
  env: InstallEnvironment;
  standalone: boolean;
}

const NOT_A_BROWSER: BrowserInstallState = { env: { userAgent: "" }, standalone: false };

export function readBrowserInstallState(
  win: BrowserWindowLike | undefined = typeof window === "undefined" ? undefined : window
): BrowserInstallState {
  if (!win) return NOT_A_BROWSER;
  try {
    const { userAgent, platform, maxTouchPoints } = win.navigator;
    return {
      env: { userAgent, platform, maxTouchPoints },
      // matchMedia is called ON the window: a copy taken off it would refuse to run
      standalone: isRunningStandalone({
        matchMedia: win.matchMedia ? (query) => win.matchMedia!(query) : undefined,
        navigator: win.navigator,
      }),
    };
  } catch {
    return NOT_A_BROWSER;
  }
}

// ---- What to show -----------------------------------------------------------

export type InstallHintKind = "none" | "install-button" | "ios-steps";

export function decideInstallHint(input: {
  env: InstallEnvironment;
  standalone: boolean;
  dismissed: boolean;
  // A Chromium browser has said the app can be installed and the prompt is still unused.
  installPromptAvailable: boolean;
}): InstallHintKind {
  if (input.standalone || input.dismissed) return "none";
  if (!isPhoneOrTablet(input.env)) return "none";
  // On an iPhone or iPad only Safari can do it, by hand. Nothing is ever offered in
  // the other browsers there, whatever they claim.
  if (isIosDevice(input.env)) return isIosSafari(input.env) ? "ios-steps" : "none";
  return input.installPromptAvailable ? "install-button" : "none";
}

// ---- Remembering a dismissal ------------------------------------------------

export const INSTALL_HINT_DISMISSED_KEY = "flippilot.installHint.dismissed";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// Browsers can refuse localStorage outright (blocked site data, some private
// windows): even reading `window.localStorage` can throw.
function browserLocalStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export interface InstallHintDismissal {
  isDismissed(): boolean;
  dismiss(): void;
}

// A dismissal is also kept in memory, so where storage is blocked the card at
// least stays away for the rest of the visit instead of coming back on every page.
export function createInstallHintDismissal(
  getStorage: () => StorageLike | null = browserLocalStorage
): InstallHintDismissal {
  let dismissedThisVisit = false;
  return {
    isDismissed() {
      if (dismissedThisVisit) return true;
      try {
        return getStorage()?.getItem(INSTALL_HINT_DISMISSED_KEY) === "1";
      } catch {
        return false;
      }
    },
    dismiss() {
      dismissedThisVisit = true;
      try {
        getStorage()?.setItem(INSTALL_HINT_DISMISSED_KEY, "1");
      } catch {
        // storage refused: the in-memory flag above is all there is
      }
    },
  };
}

// The one the app uses.
export const installHintDismissal = createInstallHintDismissal();
