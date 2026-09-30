import { describe, it, expect, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider, useAuth } from "./AuthContext";
import { BASE_URL } from "@/lib/apiBaseUrl";

// "Log out" used to only forget the login on this computer; a copy of it kept
// working for up to 7 days. It now also tells the server to cancel it
// (POST /auth/logout), and still signs this device out whatever the server does.

const TOKEN_KEY = "flippilot_office_auth_token";

function fakeStorage(start: Record<string, string>) {
  const m = new Map(Object.entries(start));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    has: (k: string) => m.has(k),
  };
}

function grabLogout(): () => void {
  let logout: (() => void) | null = null;
  function Grab() {
    logout = useAuth().logout;
    return null;
  }
  renderToStaticMarkup(
    <AuthProvider>
      <Grab />
    </AuthProvider>
  );
  return logout!;
}

afterEach(() => vi.unstubAllGlobals());

describe("Log out", () => {
  it("tells the server to cancel this login, then forgets it here", () => {
    const storage = fakeStorage({ [TOKEN_KEY]: "the-login" });
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{"ok":true}')));
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("fetch", fetchMock);

    grabLogout()();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/auth/logout`);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer the-login" });
    expect(storage.has(TOKEN_KEY)).toBe(false);
  });

  it("still signs this device out when the server can't be reached", async () => {
    const storage = fakeStorage({ [TOKEN_KEY]: "the-login" });
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));

    grabLogout()();
    await new Promise((r) => setTimeout(r, 0));
    expect(storage.has(TOKEN_KEY)).toBe(false);

    vi.stubGlobal("localStorage", (storage.setItem(TOKEN_KEY, "again"), storage));
    vi.stubGlobal("fetch", () => {
      throw new Error("no fetch here");
    });
    expect(() => grabLogout()()).not.toThrow();
    expect(storage.has(TOKEN_KEY)).toBe(false);
  });

  it("with no login on this device, there is nothing to tell the server", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("localStorage", fakeStorage({}));
    vi.stubGlobal("fetch", fetchMock);
    grabLogout()();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
