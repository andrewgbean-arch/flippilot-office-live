import { describe, it, expect, vi, afterEach } from "vitest";
import { describeSaveFailure, saveInventoryToServer, SAVE_TIMEOUT_MS } from "./inventoryStorage.web";
import type { Vehicle } from "../types/Vehicle";

// A save that didn't happen must never look like one that did. This used to
// await the request and ignore the answer, so a 413 (too many photos), a
// signed-out 401, an ended trial (402) or a dropped connection all left the
// screen showing an edit as saved that was gone after the next reload.

const car = (id: string) => ({ id, make: "Ford", model: "Fiesta" }) as unknown as Vehicle;

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
  vi.useRealTimers();
});

describe("saveInventoryToServer — what it sends", () => {
  it("PUTs the list and the deleted ids together, as JSON", async () => {
    const fetchMock = respond(200, { ok: true, items: [] });
    vi.stubGlobal("fetch", fetchMock);

    await saveInventoryToServer([car("a"), car("b")], ["gone-1", "gone-2"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/inventory$/);
    expect(init.method).toBe("PUT");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ items: [car("a"), car("b")], deletedIds: ["gone-1", "gone-2"] });
  });

  it("sends an empty deletedIds when nothing was deleted", async () => {
    const fetchMock = respond(200, { ok: true, items: [] });
    vi.stubGlobal("fetch", fetchMock);
    await saveInventoryToServer([car("a")]);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).deletedIds).toEqual([]);
  });
});

describe("saveInventoryToServer — what it reports", () => {
  it("hands back the server's merged list on success", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true, items: [{ id: "a" }, { id: "elsewhere" }] }));
    expect(await saveInventoryToServer([car("a")])).toEqual({ ok: true, items: [{ id: "a" }, { id: "elsewhere" }] });
  });

  it.each([
    [401, { ok: false, error: "Invalid or expired session" }],
    [402, { ok: false, error: "Your trial has ended" }],
    [403, { ok: false, error: "awaiting approval" }],
    [400, { ok: false, error: "Send your stock as { items: [...] }" }],
    [413, "<html>Payload Too Large</html>"],
    [500, { ok: false }],
    [503, "<html>bad gateway</html>"],
  ])("reports a %i as a failed save, with a message and the status", async (status, body) => {
    vi.stubGlobal("fetch", respond(status, body));
    const result = await saveInventoryToServer([car("a")]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(status);
    expect(result.message.length).toBeGreaterThan(20);
  });

  it("gives a 413 its own plain message about the stock being too big", async () => {
    vi.stubGlobal("fetch", respond(413, "<html>Payload Too Large</html>"));
    const result = await saveInventoryToServer([car("a")]);
    expect(result).toMatchObject({ ok: false, status: 413 });
    if (result.ok) return;
    expect(result.message).toMatch(/too big/i);
    expect(result.message).toMatch(/photos/i);
    expect(result.message).not.toMatch(/connection/i);
  });

  it("says something different for signed out, subscription ended and not allowed", () => {
    const messages = [401, 402, 403, 413].map(status => describeSaveFailure(status));
    expect(new Set(messages).size).toBe(4);
    expect(describeSaveFailure(401)).toMatch(/signed out/i);
    expect(describeSaveFailure(402)).toMatch(/subscription|trial/i);
    expect(describeSaveFailure(403)).toMatch(/approval|can't save/i);
    expect(describeSaveFailure(500)).toContain("500");
    expect(describeSaveFailure(418)).toContain("418");
  });

  it("every failure message says the changes weren't saved (or may not be)", () => {
    for (const problem of [400, 401, 402, 403, 413, 500, 503, "network", "bad-reply"] as const) {
      expect(describeSaveFailure(problem)).toMatch(/haven't been saved|may not have been saved/i);
    }
  });

  it("reports a dropped connection as a failed save, with no status", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const result = await saveInventoryToServer([car("a")]);
    expect(result).toMatchObject({ ok: false, status: null });
    if (result.ok) return;
    expect(result.message).toMatch(/reach the server/i);
  });

  it("reports a 200 whose body isn't a stock list as a failure, not a success", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true }));
    expect((await saveInventoryToServer([car("a")])).ok).toBe(false);
    vi.stubGlobal("fetch", respond(200, { ok: true, items: "nope" }));
    expect((await saveInventoryToServer([car("a")])).ok).toBe(false);
    vi.stubGlobal("fetch", respond(200, null));
    expect((await saveInventoryToServer([car("a")])).ok).toBe(false);
  });

  it("reports a 200 whose body can't be read as a failure", async () => {
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
    const result = await saveInventoryToServer([car("a")]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/expected/i);
  });

  it("gives up on a request that never answers, so it can't block every later save", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          })
      )
    );

    const pending = saveInventoryToServer([car("a")]);
    await vi.advanceTimersByTimeAsync(SAVE_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(2);
    const result = await pending;
    expect(result).toMatchObject({ ok: false, status: null });
  });
});
