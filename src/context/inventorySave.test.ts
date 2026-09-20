import { describe, it, expect, vi, afterEach } from "vitest";
import { describeSaveFailure, saveInventoryToServer, SAVE_TIMEOUT_MS } from "./inventoryStorage.web";
import type { SavePayload } from "./inventoryChanges";
import type { Vehicle } from "../types/Vehicle";

// A save that didn't happen must never look like one that did. This used to
// await the request and ignore the answer, so a 413 (too many photos), a
// signed-out 401, an ended trial (402) or a dropped connection all left the
// screen showing an edit as saved that was gone after the next reload.
//
// Saves now carry only what changed (cars created here, field-level edits,
// deletions), and an OLDER server that doesn't know about edits would ignore
// them and still answer 200 — which must not count as saved either.

const car = (id: string) => ({ id, make: "Ford", model: "Fiesta" }) as unknown as Vehicle;

// What the saver hands over. Anything not given is empty.
const payload = (over: Partial<SavePayload> = {}): SavePayload => ({ items: [], changes: [], deletedIds: [], ...over });
// A save carrying an edit of an existing car, so the server must answer with `changed`.
const editing = () => payload({ changes: [{ id: "a", set: { priceRetail: 1 } }] });

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
  it("PUTs the new cars, the field edits and the deleted ids together, as JSON", async () => {
    const fetchMock = respond(200, { ok: true, items: [], changed: 1, notFound: [] });
    vi.stubGlobal("fetch", fetchMock);

    const sent = payload({
      items: [car("new-1")],
      changes: [{ id: "a", set: { priceRetail: 6000, mot: { expiry: "x" } }, unset: ["notes"] }, { id: "b", set: { mileage: 1 } }],
      deletedIds: ["gone-1", "gone-2"],
    });
    await saveInventoryToServer(sent);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/inventory$/);
    expect(init.method).toBe("PUT");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      items: [car("new-1")],
      changes: [{ id: "a", set: { priceRetail: 6000, mot: { expiry: "x" } }, unset: ["notes"] }, { id: "b", set: { mileage: 1 } }],
      deletedIds: ["gone-1", "gone-2"],
    });
  });

  it("sends exactly items, changes and deletedIds, and always all three, even when empty", async () => {
    const fetchMock = respond(200, { ok: true, items: [] });
    vi.stubGlobal("fetch", fetchMock);
    await saveInventoryToServer(payload());
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(Object.keys(body).sort()).toEqual(["changes", "deletedIds", "items"]);
    expect(body).toEqual({ items: [], changes: [], deletedIds: [] });
  });

  it("sends an empty deletedIds when nothing was deleted", async () => {
    const fetchMock = respond(200, { ok: true, items: [] });
    vi.stubGlobal("fetch", fetchMock);
    await saveInventoryToServer(payload({ items: [car("a")] }));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).deletedIds).toEqual([]);
  });

  it("does not send the whole list: a car that isn't part of the payload isn't in the request", async () => {
    const fetchMock = respond(200, { ok: true, items: [] });
    vi.stubGlobal("fetch", fetchMock);
    await saveInventoryToServer(payload({ changes: [{ id: "a", set: { priceRetail: 1 } }] }));
    expect(fetchMock.mock.calls[0]![1].body).not.toContain("Fiesta");
  });
});

describe("saveInventoryToServer — what it reports", () => {
  it("hands back the server's merged list on success", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true, items: [{ id: "a" }, { id: "elsewhere" }] }));
    expect(await saveInventoryToServer(payload({ items: [car("a")] }))).toEqual({
      ok: true,
      items: [{ id: "a" }, { id: "elsewhere" }],
      notFound: [],
    });
  });

  it("hands back the ids of edited cars the server no longer has", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true, items: [{ id: "b" }], changed: 1, notFound: ["a", "c"] }));
    expect(await saveInventoryToServer(payload({ changes: [{ id: "a", set: { x: 1 } }, { id: "b", set: { x: 1 } }, { id: "c", set: { x: 1 } }] }))).toEqual({
      ok: true,
      items: [{ id: "b" }],
      notFound: ["a", "c"],
    });
  });

  it("no notFound in the reply means none were missing, and anything that isn't an id is ignored", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true, items: [], changed: 1 }));
    expect(await saveInventoryToServer(editing())).toMatchObject({ ok: true, notFound: [] });
    vi.stubGlobal("fetch", respond(200, { ok: true, items: [], changed: 1, notFound: "a" }));
    expect(await saveInventoryToServer(editing())).toMatchObject({ ok: true, notFound: [] });
    vi.stubGlobal("fetch", respond(200, { ok: true, items: [], changed: 1, notFound: ["a", 5, null, {}, "b"] }));
    expect(await saveInventoryToServer(editing())).toMatchObject({ ok: true, notFound: ["a", "b"] });
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
    const result = await saveInventoryToServer(payload({ items: [car("a")] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(status);
    expect(result.message.length).toBeGreaterThan(20);
  });

  it.each([401, 402, 403, 413, 400, 500, 503])(
    "a %i is the same failure when the save carried edits (the old-server rule only applies to a 200)",
    async status => {
      vi.stubGlobal("fetch", respond(status, { ok: false }));
      const result = await saveInventoryToServer(editing());
      expect(result).toMatchObject({ ok: false, status });
      if (result.ok) return;
      expect(result.message).toBe(describeSaveFailure(status));
      expect(result.message).not.toMatch(/hasn't been updated/i);
    }
  );

  it("an error status is a failed save even if the body happens to look like a stock list", async () => {
    vi.stubGlobal("fetch", respond(500, { ok: true, items: [{ id: "a" }], changed: 1 }));
    expect(await saveInventoryToServer(editing())).toMatchObject({ ok: false, status: 500 });
  });

  it("gives a 413 its own plain message about the stock being too big", async () => {
    vi.stubGlobal("fetch", respond(413, "<html>Payload Too Large</html>"));
    const result = await saveInventoryToServer(payload({ items: [car("a")] }));
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

  it("a 5xx is the server's trouble, try again soon; any other unexpected status is refused", () => {
    for (const status of [500, 502, 503, 599]) expect(describeSaveFailure(status), String(status)).toMatch(/had a problem saving/i);
    for (const status of [400, 404, 418, 499]) expect(describeSaveFailure(status), String(status)).toMatch(/wouldn't accept/i);
  });

  it("every failure message says the changes weren't saved (or may not be)", () => {
    for (const problem of [400, 401, 402, 403, 413, 500, 503, "network", "bad-reply", "old-server"] as const) {
      expect(describeSaveFailure(problem)).toMatch(/haven't been saved|may not have been saved|are not saved/i);
    }
  });

  it("reports a dropped connection as a failed save, with no status", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const result = await saveInventoryToServer(payload({ items: [car("a")] }));
    expect(result).toMatchObject({ ok: false, status: null });
    if (result.ok) return;
    expect(result.message).toMatch(/reach the server/i);
  });

  it("reports a 200 whose body isn't a stock list as a failure, not a success", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true }));
    expect((await saveInventoryToServer(payload({ items: [car("a")] }))).ok).toBe(false);
    vi.stubGlobal("fetch", respond(200, { ok: true, items: "nope" }));
    expect((await saveInventoryToServer(payload({ items: [car("a")] }))).ok).toBe(false);
    vi.stubGlobal("fetch", respond(200, null));
    expect((await saveInventoryToServer(payload({ items: [car("a")] }))).ok).toBe(false);
  });

  it("a 200 that isn't a stock list is the bad-reply message, not the old-server one, even with edits", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true }));
    const result = await saveInventoryToServer(editing());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe(describeSaveFailure("bad-reply"));
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
    const result = await saveInventoryToServer(payload({ items: [car("a")] }));
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

    const pending = saveInventoryToServer(payload({ items: [car("a")] }));
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

// An older server doesn't know about `changes`: it ignores them, applies the
// (empty) `items` and answers 200 with the list — but no `changed`. That is an
// edit silently thrown away, so it has to come back as a failed save.
describe("saveInventoryToServer — an older server that ignores field-level edits", () => {
  const OLD_SERVER_REPLY = { ok: true, items: [{ id: "a" }] };

  it("a 200 with no `changed`, for a save that carried edits, is a failed save with a plain message", async () => {
    vi.stubGlobal("fetch", respond(200, OLD_SERVER_REPLY));
    const result = await saveInventoryToServer(editing());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(200);
    expect(result.message).toBe(
      "The server hasn't been updated to accept this kind of save yet, so your changes are not saved. Try again in a few minutes."
    );
  });

  it("one edit among other things is enough to need the answer", async () => {
    vi.stubGlobal("fetch", respond(200, OLD_SERVER_REPLY));
    const result = await saveInventoryToServer(
      payload({ items: [car("n")], changes: [{ id: "a", unset: ["notes"] }], deletedIds: ["z"] })
    );
    expect(result.ok).toBe(false);
  });

  it("a `changed` that isn't a number doesn't count either", async () => {
    for (const changed of ["1", null, true, {}, [1]]) {
      vi.stubGlobal("fetch", respond(200, { ok: true, items: [], changed }));
      expect((await saveInventoryToServer(editing())).ok, JSON.stringify(changed)).toBe(false);
    }
  });

  it("a `changed` of zero is an answer (nothing applied, everything not found): a real reply", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true, items: [], changed: 0, notFound: ["a"] }));
    expect(await saveInventoryToServer(editing())).toEqual({ ok: true, items: [], notFound: ["a"] });
  });

  it("a `changed` that is a number is accepted", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true, items: [{ id: "a" }], changed: 3, notFound: [] }));
    expect(await saveInventoryToServer(editing())).toMatchObject({ ok: true });
  });

  it("the same reply for a save with no edits is fine: an old server does everything that save asked", async () => {
    vi.stubGlobal("fetch", respond(200, OLD_SERVER_REPLY));
    expect(await saveInventoryToServer(payload({ items: [car("a")] }))).toMatchObject({ ok: true });
    expect(await saveInventoryToServer(payload({ deletedIds: ["z"] }))).toMatchObject({ ok: true });
    expect(await saveInventoryToServer(payload())).toMatchObject({ ok: true }); // a plain sync
  });

  it("is its own message, different from every other failure", () => {
    const all = [400, 401, 402, 403, 413, 500, "network", "bad-reply"] as const;
    for (const problem of all) expect(describeSaveFailure("old-server")).not.toBe(describeSaveFailure(problem));
    expect(describeSaveFailure("old-server")).toMatch(/not saved/i);
    expect(describeSaveFailure("old-server")).toMatch(/few minutes/i);
  });
});
