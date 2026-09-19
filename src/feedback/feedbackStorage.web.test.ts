import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fetchFeedback, loadFeedback, submitFeedback, updateFeedbackStatus } from "./feedbackStorage.web";

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => "test-token" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const PHOTO = { id: "3f2b8c1e-9a4d-4e7b-8c55-0d1f6a7b9e21", url: "https://api.example.com/photos/x?sig=abc" };
const ENTRY = {
  id: "e1",
  userId: null,
  userName: null,
  message: "",
  photos: [PHOTO],
  status: "new",
  createdAt: "2026-09-19T10:00:00.000Z",
};

describe("submitFeedback", () => {
  it("sends the photo ids with an anonymous post and hands back the entry with its photos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { ok: true, entry: ENTRY }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitFeedback({ message: "", anonymous: true, photoIds: [PHOTO.id] });

    expect(result.ok).toBe(true);
    expect(result.entry?.photos).toEqual([PHOTO]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/feedback$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(init.body)).toEqual({ message: "", anonymous: true, photoIds: [PHOTO.id] });
  });

  it("leaves photoIds out when there are none", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { ok: true, entry: ENTRY }));
    vi.stubGlobal("fetch", fetchMock);

    await submitFeedback({ message: "hello", anonymous: false });
    await submitFeedback({ message: "hello", anonymous: false, photoIds: [] });
    await submitFeedback({ message: "hello", anonymous: false, photoIds: undefined });

    for (const call of fetchMock.mock.calls) {
      expect(JSON.parse(call[1].body)).toEqual({ message: "hello", anonymous: false });
    }
  });

  it("gives back the server's error text", async () => {
    const error = "One of those photos couldn't be attached — add it again and retry";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(400, { ok: false, error })));
    const result = await submitFeedback({ message: "hi", anonymous: false, photoIds: ["gone"] });
    expect(result).toMatchObject({ ok: false, error });
  });
});

describe("photos survive the list calls", () => {
  it("loadFeedback keeps each item's photos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, { ok: true, items: [ENTRY] })));
    const items = await loadFeedback();
    expect(items[0]?.photos).toEqual([PHOTO]);
  });

  it("updateFeedbackStatus hands back the whole list with photos, for the screen to replace its own with", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply(200, { ok: true, items: [{ ...ENTRY, status: "reviewed" }] }))
    );
    const result = await updateFeedbackStatus("e1", "reviewed");
    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.photos).toEqual([PHOTO]);
    expect(result.items[0]?.status).toBe("reviewed");
  });
});

describe("fetchFeedback — a refresh must be able to tell 'nothing posted' from 'couldn't reach the server'", () => {
  it("returns the entries, photos included", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, { ok: true, items: [ENTRY] })));
    expect(await fetchFeedback()).toEqual([ENTRY]);
  });

  it("returns an empty list (not null) when the board really is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, { ok: true, items: [] })));
    expect(await fetchFeedback()).toEqual([]);
  });

  it("returns null on every kind of failure, so a board on screen is never blanked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const failing of [
      vi.fn().mockRejectedValue(new Error("offline")),
      vi.fn().mockResolvedValue(reply(401, { ok: false })),
      vi.fn().mockResolvedValue(reply(500, { ok: false })),
      vi.fn().mockResolvedValue(reply(200, { ok: true })), // no items list at all
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error("not json"); } }),
    ]) {
      vi.stubGlobal("fetch", failing);
      expect(await fetchFeedback()).toBeNull();
    }
  });
});
