import { describe, it, expect, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import InstallHint, { InstallHintCard } from "./InstallHint";
import JoinSuccessStep from "../screens/JoinSuccessStep";
import { INSTALL_HINT_DISMISSED_KEY } from "./installHintRules";

const SRC = join(__dirname, "..");
const source = (relative: string) => readFileSync(join(SRC, relative), "utf8");

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.99 Mobile Safari/537.36";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const noop = () => undefined;

describe("the home-screen card", () => {
  it("with an Install app button for Chrome and Edge on Android", () => {
    const html = renderToStaticMarkup(<InstallHintCard kind="install-button" onInstall={noop} onDismiss={noop} />);
    expect(html).toContain("Put FlipPilot on your home screen");
    expect(html).toContain("Install app");
    expect(html).toContain('aria-label="Dismiss"');
    expect(html).not.toContain("<ol");
    expect(html).not.toContain("Share button");
  });

  it("with the two taps for iPhone and iPad Safari, and no button that would do nothing there", () => {
    const html = renderToStaticMarkup(<InstallHintCard kind="ios-steps" onInstall={noop} onDismiss={noop} />);
    expect(html).toContain("<ol");
    expect(html).toMatch(/tap the share button/i);
    expect(html).toContain("Add to Home Screen");
    expect(html).toContain('aria-label="Dismiss"');
    expect(html).not.toContain("Install app");
  });
});

// The card the way the dashboard uses it, with a stand-in for `window` so the
// code sees a phone (or a computer) and its storage.
describe("InstallHint, as the dashboard shows it", () => {
  afterEach(() => vi.unstubAllGlobals());

  function browser(
    userAgent: string,
    over: { standalone?: boolean; stored?: Record<string, string>; storageBlocked?: boolean } = {}
  ) {
    const stored = over.stored ?? {};
    const win: Record<string, unknown> = {
      navigator: { userAgent, platform: "iPhone", maxTouchPoints: 5, standalone: over.standalone },
      matchMedia: () => ({ matches: false }),
    };
    if (over.storageBlocked) {
      Object.defineProperty(win, "localStorage", {
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    } else {
      win.localStorage = { getItem: (key: string) => stored[key] ?? null, setItem: () => undefined };
    }
    vi.stubGlobal("window", win);
  }

  it("shows nothing where there is no browser window at all", () => {
    expect(renderToStaticMarkup(<InstallHint />)).toBe("");
  });

  it("shows the steps on an iPhone in Safari, inside the wrapper it is given", () => {
    browser(IPHONE_SAFARI);
    const html = renderToStaticMarkup(<InstallHint className="-mb-10" />);
    expect(html).toContain('class="-mb-10"');
    expect(html).toContain('aria-label="Install FlipPilot"');
    expect(html).toContain("Add to Home Screen");
    expect(html).not.toContain("Install app");
  });

  it("shows nothing on an iPhone once the app is running from the home screen", () => {
    browser(IPHONE_SAFARI, { standalone: true });
    expect(renderToStaticMarkup(<InstallHint />)).toBe("");
  });

  it("shows nothing once it has been dismissed", () => {
    browser(IPHONE_SAFARI, { stored: { [INSTALL_HINT_DISMISSED_KEY]: "1" } });
    expect(renderToStaticMarkup(<InstallHint />)).toBe("");
  });

  it("still shows on an iPhone whose browser blocks storage", () => {
    browser(IPHONE_SAFARI, { storageBlocked: true });
    expect(renderToStaticMarkup(<InstallHint />)).toContain("Add to Home Screen");
  });

  it("shows nothing on Android until Chrome has said the app can be installed", () => {
    browser(ANDROID_CHROME);
    expect(renderToStaticMarkup(<InstallHint />)).toBe("");
  });

  it("shows nothing on a computer", () => {
    browser(WINDOWS_CHROME);
    expect(renderToStaticMarkup(<InstallHint />)).toBe("");
  });
});

describe("the step after an invited person has joined", () => {
  const render = (hint: "none" | "install-button" | "ios-steps", dealershipName = "Smith Motors") =>
    renderToStaticMarkup(
      <JoinSuccessStep
        dealershipName={dealershipName}
        hint={hint}
        onInstall={noop}
        onDismissHint={noop}
        onContinue={noop}
      />
    );

  it("welcomes them to the dealership and lets them carry on", () => {
    const html = render("none");
    expect(html).toContain("welcome to Smith Motors");
    expect(html).toContain("Continue to FlipPilot");
    expect(html).not.toContain("Install FlipPilot");
  });

  it("shows the two taps on an iPhone, above the Continue button", () => {
    const html = render("ios-steps");
    expect(html).toContain("Add to Home Screen");
    expect(html.indexOf("Add to Home Screen")).toBeLessThan(html.indexOf("Continue to FlipPilot"));
  });

  it("shows the Install app button on Android", () => {
    expect(render("install-button")).toContain("Install app");
  });

  it("does not say 'undefined' when the dealership's name is missing", () => {
    const html = render("none", "");
    expect(html).not.toContain("undefined");
    expect(html).toContain("welcome");
  });
});

// The pieces have to be wired in where the people are.
describe("where the card is used", () => {
  it("JoinScreen goes to the 'you're in' step only when there is something to offer, and going on counts as an answer", () => {
    const screen = source("screens/JoinScreen.tsx");
    expect(screen).toContain('from "@/pwa/InstallHint"');
    expect(screen).toContain("useInstallHint()");
    expect(screen).toContain("<JoinSuccessStep");
    expect(screen).toContain("setJoined(true);");
    expect(screen).toContain('if (installHint.kind === "none") {');
    expect(screen).toContain('if (installHint.kind !== "none") installHint.dismiss();');
  });

  it("JoinScreen still goes straight in after a successful join when nothing is offered", () => {
    const screen = source("screens/JoinScreen.tsx");
    const noneBranch = screen.indexOf('if (installHint.kind === "none") {');
    expect(screen.indexOf('navigate("/", { replace: true });', noneBranch)).toBeGreaterThan(noneBranch);
    // and the step only follows a join that worked
    expect(screen.indexOf("if (!result.ok) {")).toBeLessThan(screen.indexOf("setJoined(true);"));
  });

  it("the card's hook follows the install signal, reads and saves the dismissal, and hands the tap to the browser", () => {
    const hook = source("pwa/InstallHint.tsx");
    expect(hook).toContain("useSyncExternalStore(");
    expect(hook).toContain("installHintDismissal.isDismissed()");
    expect(hook).toContain("installHintDismissal.dismiss();");
    expect(hook).toContain("installPromptStore.prompt()");
    // installed, or turned down in the browser's own dialog: the card goes for good
    expect(hook).toContain('if (outcome !== "unavailable") dismiss();');
  });

  it("the dealer dashboard shows it once, above the greeting", () => {
    const dashboard = source("dealer/dashboard/DealerDashboard.tsx");
    expect(dashboard).toContain('import InstallHint from "@/pwa/InstallHint";');
    expect((dashboard.match(/<InstallHint/g) ?? []).length).toBe(1);
    expect(dashboard.indexOf("<InstallHint")).toBeLessThan(dashboard.indexOf("{/* GREETING */}"));
  });

  it("the app starts listening for the install signal before it renders anything", () => {
    const main = source("main.tsx");
    expect(main).toContain('import { startInstallPromptCapture } from "./pwa/installPromptStore";');
    expect(main.indexOf("startInstallPromptCapture();")).toBeGreaterThan(-1);
    expect(main.indexOf("startInstallPromptCapture();")).toBeLessThan(main.indexOf("createRoot("));
  });
});
