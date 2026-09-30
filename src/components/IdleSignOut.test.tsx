import { describe, it, expect, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { StillThereCard } from "./IdleSignOut";
import { AutoSignOutCardView, choiceLabel } from "@/dealer/settings/AutoSignOutCard";
import { AuthProvider } from "@/context/AuthContext";
import LoginScreen from "@/screens/LoginScreen";

// What people see of the automatic sign-out: the warning a minute before, the
// owner's choice in Settings, and the note on the sign-in page afterwards.

const source = (relative: string) => readFileSync(join(__dirname, "..", relative), "utf8");
const noop = () => undefined;

afterEach(() => vi.unstubAllGlobals());

describe("the warning a minute before", () => {
  it("says how long is left and what to do", () => {
    const html = renderToStaticMarkup(<StillThereCard minutes={15} secondsLeft={42} />);
    expect(html).toContain("Still there?");
    expect(html).toContain("hasn&#x27;t been used for 14 minutes");
    expect(html).toContain("42 seconds");
    expect(html).toContain("I&#x27;m still here");
    expect(html).toContain('role="alertdialog"');
  });
});

describe("the Settings card", () => {
  it("lets the owner choose 15, 30 or 60 minutes, or never, showing the current choice", () => {
    const html = renderToStaticMarkup(
      <AutoSignOutCardView current={30} canChange saving={false} error={null} onChoose={noop} />
    );
    expect(html).toContain("Automatic Sign-Out");
    expect(html).toContain("<select");
    for (const m of [15, 30, 60, 0]) expect(html).toContain(`<option value="${m}"`);
    expect(html).toMatch(/<option value="30" selected="">30 minutes<\/option>/);
    expect(html).toContain("15 minutes (recommended)");
    expect(html).toContain(">Never</option>");
  });

  it("shows Never selected, with a word of warning, when it's off", () => {
    const html = renderToStaticMarkup(
      <AutoSignOutCardView current={null} canChange saving={false} error={null} onChoose={noop} />
    );
    expect(html).toMatch(/<option value="0" selected="">Never<\/option>/);
    expect(html).toContain("Only choose Never if every computer is somewhere nobody else can get to it.");
  });

  it("tells staff what it is set to, with nothing they can change", () => {
    const on = renderToStaticMarkup(
      <AutoSignOutCardView current={15} canChange={false} saving={false} error={null} onChoose={noop} />
    );
    expect(on).not.toContain("<select");
    expect(on).toContain("Dealer OS signs out after 15 minutes with nobody using it.");
    expect(on).toContain("Only the owner can change this.");

    const off = renderToStaticMarkup(
      <AutoSignOutCardView current={null} canChange={false} saving={false} error={null} onChoose={noop} />
    );
    expect(off).toContain("Turned off by the owner.");
  });

  it("shows a save failure", () => {
    const html = renderToStaticMarkup(
      <AutoSignOutCardView current={15} canChange saving={false} error="Couldn't save that — try again." onChoose={noop} />
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Couldn&#x27;t save that");
  });

  it("labels", () => {
    expect(choiceLabel(0)).toBe("Never");
    expect(choiceLabel(60)).toBe("1 hour");
    expect(choiceLabel(30)).toBe("30 minutes");
  });

  it("is in Settings for everyone, and the owner's choice is what the server accepts", () => {
    expect(source("dealer/settings/Settings.tsx")).toMatch(/\n\s*<AutoSignOutCard \/>/);
    expect(source("backend/src/auth.ts")).toContain("AUTO_SIGN_OUT_CHOICES: readonly number[] = [0, 15, 30, 60]");
  });
});

describe("where it runs", () => {
  it("on every signed-in page: ProtectedRoute mounts it once the user is in", () => {
    const route = source("components/ProtectedRoute.tsx");
    const signedInPart = route.slice(route.indexOf('if (approvalStatus === "pending")'));
    expect(signedInPart).toContain("<IdleSignOut />");
    expect(route.slice(0, route.indexOf("if (!user)"))).not.toContain("<IdleSignOut />");
  });

  // Found in the browser: with a flag the load effect set, there was one render
  // where the user had arrived but "loading" was already false and the setting
  // not yet in, so a reload signed out an owner who had chosen 1 hour or never.
  // These tests run without a browser and can't replay that render, so this
  // holds the fix in place: `loading` is worked out during render.
  it("waits for the dealership's own setting, worked out on every render, not set a render late", () => {
    const ctx = source("context/DealerContext.tsx");
    expect(ctx).toContain("const loading = wanted !== null && loadedFor !== wanted;");
    expect(ctx).not.toMatch(/setLoading\(/);
    const idle = source("components/IdleSignOut.tsx");
    expect(idle).toContain("if (!user || loading || minutes === null)");
    expect(idle).toContain("dealer.id === user?.dealershipId");
    // and leaves the note for the sign-in page before signing out
    expect(idle.indexOf("rememberIdleSignOut(minutes)")).toBeGreaterThan(-1);
    expect(idle.indexOf("rememberIdleSignOut(minutes)")).toBeLessThan(idle.indexOf("logoutRef.current()"));
  });
});

describe("the sign-in page afterwards", () => {
  function fakeStorage(start: Record<string, string>) {
    const m = new Map(Object.entries(start));
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  }
  const render = () =>
    renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <LoginScreen />
        </AuthProvider>
      </MemoryRouter>
    );

  it("says why you were signed out", () => {
    vi.stubGlobal("localStorage", fakeStorage({}));
    vi.stubGlobal("sessionStorage", fakeStorage({ flippilot_signed_out_idle_minutes: "30" }));
    expect(render()).toContain("You were signed out because Dealer OS wasn&#x27;t used for 30 minutes.");
  });

  it("says nothing extra after an ordinary log out", () => {
    vi.stubGlobal("localStorage", fakeStorage({}));
    vi.stubGlobal("sessionStorage", fakeStorage({}));
    expect(render()).not.toContain("You were signed out");
  });
});
