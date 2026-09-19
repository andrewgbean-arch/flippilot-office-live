import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { uploadMessagePhoto, discardMessagePhoto } from "./messagePhotosApi";

const ID = "3f2b8c1e-9a4d-4e7b-8c55-0d1f6a7b9e21";
const DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

beforeEach(() => {
  // authHeaders() reads the sign-in token from localStorage; give it one so the
  // tests can see the Authorization header go out.
  vi.stubGlobal("localStorage", { getItem: () => "test-token" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function reply(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new Error("not json");
      return body;
    },
  };
}

describe("uploadMessagePhoto", () => {
  it("returns the new photo's id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, { ok: true, photo: { id: ID } })));
    expect(await uploadMessagePhoto(DATA_URL)).toEqual({ ok: true, id: ID });
  });

  it("posts the picture as JSON to /message-photos with the sign-in token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { ok: true, photo: { id: ID } }));
    vi.stubGlobal("fetch", fetchMock);
    await uploadMessagePhoto(DATA_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/message-photos$/);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(init.body)).toEqual({ dataUrl: DATA_URL });
  });

  it.each([
    [400, "That doesn't look like a JPEG, PNG or WebP photo"],
    [401, "Please sign in again"],
    [403, "Your account is awaiting approval"],
    [409, "You have a lot of photos waiting to be sent — send or remove some first"],
    [413, "That photo is too large (the limit is 1.5 MB)"],
  ])("shows the server's own message when it answers %i", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(status, { ok: false, error: message })));
    expect(await uploadMessagePhoto(DATA_URL)).toEqual({ ok: false, error: message });
  });

  it("still says something readable when the error isn't JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(502)));
    const result = await uploadMessagePhoto(DATA_URL);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/couldn't upload/i);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(413)));
    expect((await uploadMessagePhoto(DATA_URL)).error).toMatch(/too large/i);
  });

  it("doesn't count a success reply with no photo id as a success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, { ok: true })));
    const result = await uploadMessagePhoto(DATA_URL);
    expect(result.ok).toBe(false);
    expect(result.id).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("reports a network failure instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const result = await uploadMessagePhoto(DATA_URL);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/reach the server/);
  });
});

describe("discardMessagePhoto", () => {
  it("calls DELETE on that photo with the sign-in token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await discardMessagePhoto(ID);

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(new RegExp(`/message-photos/${ID}$`));
    expect(init.method).toBe("DELETE");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.body).toBeUndefined();
  });

  it("puts the id in the address safely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await discardMessagePhoto("a/b c");
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/message-photos\/a%2Fb%20c$/);
  });

  it("treats 'already gone' as done", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply(404, { ok: false, error: "That photo wasn't found" }))
    );
    expect((await discardMessagePhoto(ID)).ok).toBe(true);
  });

  it("reports the server's reason when it refuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(403, { ok: false, error: "Not allowed" })));
    expect(await discardMessagePhoto(ID)).toEqual({ ok: false, error: "Not allowed" });
  });

  it("reports a network failure instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const result = await discardMessagePhoto(ID);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/reach the server/);
  });
});
