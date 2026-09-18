import { describe, it, expect, vi, afterEach } from "vitest";
import { loadJson, loadList } from "./loadJson";

// loadJson / loadList are the shared "load my data" primitives. Every
// storage loader is built on them, so their rule is tested directly here
// (and once per loader in storageLoaders.test.ts): a failed read is null,
// and only a successful answer is ever a value.

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

describe("loadJson", () => {
  it("returns the parsed body on success", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true, hello: "world" }));
    expect(await loadJson("/anything")).toEqual({ ok: true, hello: "world" });
  });

  it("returns null when the connection drops", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await loadJson("/anything")).toBeNull();
  });

  it.each([401, 402, 403, 404, 500, 503])("returns null on a %i even when the body parses", async status => {
    vi.stubGlobal("fetch", respond(status, { ok: false, error: "no" }));
    expect(await loadJson("/anything")).toBeNull();
  });

  it("sends the signed-in user's token, so the request is for THEIR dealership", async () => {
    vi.stubGlobal("localStorage", { getItem: () => "the-token" });
    const fetchMock = respond(200, {});
    vi.stubGlobal("fetch", fetchMock);
    await loadJson("/jobs");
    const init = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
    expect(init.headers).toMatchObject({ Authorization: "Bearer the-token" });
  });
});

describe("loadList", () => {
  it("returns the items", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true, items: [1, 2, 3] }));
    expect(await loadList<number>("/x")).toEqual([1, 2, 3]);
  });

  it("returns [] only for a successful empty list", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true, items: [] }));
    expect(await loadList("/x")).toEqual([]);
  });

  it("returns null when the read failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await loadList("/x")).toBeNull();
    vi.stubGlobal("fetch", respond(500, { ok: false }));
    expect(await loadList("/x")).toBeNull();
  });

  it("does not trust a list that arrives with an error status", async () => {
    vi.stubGlobal("fetch", respond(500, { ok: true, items: [{ id: "x" }] }));
    expect(await loadList("/x")).toBeNull();
  });

  it("returns null when the body has no list, a non-list, or is itself null", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true }));
    expect(await loadList("/x")).toBeNull();
    vi.stubGlobal("fetch", respond(200, { ok: true, items: { not: "a list" } }));
    expect(await loadList("/x")).toBeNull();
    vi.stubGlobal("fetch", respond(200, null));
    expect(await loadList("/x")).toBeNull();
  });
});
