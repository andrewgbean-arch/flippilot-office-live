import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { BASE_URL } from "@/lib/apiBaseUrl";
import { saveJobs } from "./jobStorage.web";
import { saveLeads } from "@/dealer/leads/leadStorage.web";

// Removing a lead or a job is refused for some roles, so a save has to say
// whether the server kept it: the screen only changes when it did.

const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("localStorage", { getItem: () => "test-token", setItem: () => undefined, removeItem: () => undefined });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each([
  ["jobs", saveJobs, "/jobs"],
  ["leads", saveLeads, "/leads"],
] as const)("saving %s", (_name, save, path) => {
  it("sends the whole list with the login, and reports success", async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true, items: [] }));
    expect(await save([{ id: "a" }] as never)).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(`${BASE_URL}${path}`);
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(String(init.body))).toEqual({ items: [{ id: "a" }] });
  });

  it("passes on the server's reason when it refuses", async () => {
    fetchMock.mockResolvedValue(json(403, { ok: false, error: "Only managers and the owner can delete a job. Nothing was saved." }));
    expect(await save([] as never)).toEqual({ ok: false, error: "Only managers and the owner can delete a job. Nothing was saved." });
  });

  it("says it wasn't saved when the server can't be reached or gives no reason", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect((await save([] as never)).ok).toBe(false);
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("not json"); } });
    expect(await save([] as never)).toEqual({ ok: false, error: "That couldn't be saved. Please try again." });
  });
});
