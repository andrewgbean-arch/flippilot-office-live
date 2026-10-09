import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { authHeaders, dealershipOfToken, loginIsForAnotherDealership, setAuthToken } from "./authToken";
import { DifferentDealershipCard } from "@/components/DifferentDealershipBanner";

// Every browser tab shares one login. Each tab remembers the dealership it was
// loaded under and sends it with every request, so the server can refuse a tab
// whose login has been swapped for another dealership's by a second tab.

const TOKEN_KEY = "flippilot_office_auth_token";

function fakeStorage(start: Record<string, string> = {}) {
  const m = new Map(Object.entries(start));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const b64url = (s: string) => Buffer.from(s).toString("base64url");
const loginFor = (dealershipId: string | undefined) =>
  `${b64url('{"alg":"HS256"}')}.${b64url(JSON.stringify({ id: "u1", ...(dealershipId ? { dealershipId } : {}) }))}.signature`;

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage());
  setAuthToken(null);
});
afterEach(() => vi.unstubAllGlobals());

describe("reading the dealership out of a login", () => {
  it("finds it", () => {
    expect(dealershipOfToken(loginFor("dealer-a"))).toBe("dealer-a");
  });

  it("reads real logins, whose encoding swaps + and / for - and _", () => {
    const payload = b64url('{"dealershipId":"dealer-u","name":"???>>>"}');
    expect(payload).toMatch(/[-_]/); // the case this guards: url-safe characters in the payload
    expect(dealershipOfToken(`x.${payload}.y`)).toBe("dealer-u");
  });

  it("gives null for a login it cannot read, never throws", () => {
    expect(dealershipOfToken("not-a-login")).toBeNull();
    expect(dealershipOfToken("a.b.c")).toBeNull();
    expect(dealershipOfToken(loginFor(undefined))).toBeNull();
    expect(dealershipOfToken("")).toBeNull();
  });
});

describe("what every request says", () => {
  it("says nothing when nobody is signed in", () => {
    expect(authHeaders()).toEqual({});
  });

  it("sends the login and the dealership it belongs to", () => {
    setAuthToken(loginFor("dealer-a"));
    expect(authHeaders()).toEqual({ Authorization: `Bearer ${loginFor("dealer-a")}`, "X-Dealership-Id": "dealer-a" });
  });

  it("keeps saying the dealership the tab was loaded under when another tab swaps the login", () => {
    setAuthToken(loginFor("dealer-a"));
    localStorage.setItem(TOKEN_KEY, loginFor("dealer-b")); // what the other tab does
    expect(authHeaders()).toEqual({ Authorization: `Bearer ${loginFor("dealer-b")}`, "X-Dealership-Id": "dealer-a" });
  });

  it("takes the dealership from the login already stored when the page loads", () => {
    vi.stubGlobal("localStorage", fakeStorage({ [TOKEN_KEY]: loginFor("dealer-c") }));
    expect(authHeaders()["X-Dealership-Id"]).toBe("dealer-c");
  });

  it("follows this tab's own sign-in to another dealership, and forgets on sign-out", () => {
    setAuthToken(loginFor("dealer-a"));
    setAuthToken(loginFor("dealer-b"));
    expect(authHeaders()["X-Dealership-Id"]).toBe("dealer-b");
    setAuthToken(null);
    expect(authHeaders()).toEqual({});
  });

  it("sends only the login, as before, when the dealership can't be read from it", () => {
    setAuthToken("opaque-login");
    expect(authHeaders()).toEqual({ Authorization: "Bearer opaque-login" });
  });
});

describe("noticing that another tab signed in somewhere else", () => {
  it("is false while the login is still this tab's dealership", () => {
    setAuthToken(loginFor("dealer-a"));
    expect(loginIsForAnotherDealership()).toBe(false);
  });

  it("is true once another tab signs in to a different dealership", () => {
    setAuthToken(loginFor("dealer-a"));
    localStorage.setItem(TOKEN_KEY, loginFor("dealer-b"));
    expect(loginIsForAnotherDealership()).toBe(true);
  });

  it("is false when another tab signs in again to the same dealership, or signs out", () => {
    setAuthToken(loginFor("dealer-a"));
    localStorage.setItem(TOKEN_KEY, loginFor("dealer-a"));
    expect(loginIsForAnotherDealership()).toBe(false);
    localStorage.removeItem(TOKEN_KEY);
    expect(loginIsForAnotherDealership()).toBe(false);
  });
});

describe("what the tab tells the person", () => {
  it("says what happened and offers the reload", () => {
    const html = renderToStaticMarkup(createElement(DifferentDealershipCard));
    expect(html).toContain("You signed in to a different dealership");
    expect(html).toContain("Reload this page");
    expect(html).toContain('role="alertdialog"');
  });
});
