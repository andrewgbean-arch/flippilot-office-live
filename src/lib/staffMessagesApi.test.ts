import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { submitStaffMessage } from "./staffMessagesApi";

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

describe("submitStaffMessage", () => {
  it("sends the photo ids along with the words", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { ok: true, message: {} }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitStaffMessage("user-2", "look at this", ["p1", "p2"]);

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/staff-messages$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(init.body)).toEqual({ toUserId: "user-2", message: "look at this", photoIds: ["p1", "p2"] });
  });

  it("can send photos alone, with empty words", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await submitStaffMessage("user-2", "", ["p1"]);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ toUserId: "user-2", message: "", photoIds: ["p1"] });
  });

  it("leaves photoIds out when there are none, so a text-only message is unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await submitStaffMessage("user-2", "just words");
    await submitStaffMessage("user-2", "just words", []);

    for (const call of fetchMock.mock.calls) {
      expect(JSON.parse(call[1].body)).toEqual({ toUserId: "user-2", message: "just words" });
    }
  });

  it("gives back the server's error text", async () => {
    const error = "One of those photos couldn't be attached — add it again and retry";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(400, { ok: false, error })));
    expect(await submitStaffMessage("user-2", "hi", ["gone"])).toEqual({ ok: false, error });
  });

  it("reports a network failure instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await submitStaffMessage("user-2", "hi", ["p1"])).toEqual({ ok: false, error: "Network error" });
  });
});
