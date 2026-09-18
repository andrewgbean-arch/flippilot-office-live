import { describe, it, expect, vi, afterEach } from "vitest";
import { loadInventoryFromServer } from "./inventoryStorage.web";

// The one rule that matters here: "the server says this dealer has no
// vehicles" and "we couldn't read the stock" must never look the same.
// The provider seeds/overwrites on an empty answer, so conflating them
// once cost a dealer their real stock (see inventoryStorage.web.ts).

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadInventoryFromServer", () => {
  it("returns the vehicles when the server has some", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true, items: [{ id: "v1" }, { id: "v2" }] }));
    expect(await loadInventoryFromServer()).toEqual([{ id: "v1" }, { id: "v2" }]);
  });

  it("returns an empty array only when the server successfully says the stock is empty", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true, items: [] }));
    expect(await loadInventoryFromServer()).toEqual([]);
  });

  it("returns null — not an empty list — when the connection drops", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await loadInventoryFromServer()).toBeNull();
  });

  it.each([
    [401, { ok: false, error: "Invalid or expired session" }],
    [402, { ok: false, error: "Your trial has ended" }],
    [403, { ok: false, error: "awaiting approval" }],
    [500, { ok: false, error: "boom" }],
  ])("returns null when the server answers %i", async (status, body) => {
    vi.stubGlobal("fetch", respond(status, body));
    expect(await loadInventoryFromServer()).toBeNull();
  });

  it("returns null for a 200 whose body isn't a stock list", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true }));
    expect(await loadInventoryFromServer()).toBeNull();
    vi.stubGlobal("fetch", respond(200, { ok: true, items: "nope" }));
    expect(await loadInventoryFromServer()).toBeNull();
  });

  it("returns null when the body can't be parsed at all", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      })
    );
    expect(await loadInventoryFromServer()).toBeNull();
  });
});
