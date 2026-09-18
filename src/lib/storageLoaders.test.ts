import { describe, it, expect, vi, afterEach } from "vitest";
import { loadJobs } from "@/jobs/jobStorage.web";
import { loadLeads } from "@/dealer/leads/leadStorage.web";
import { loadStaff, deleteStaff } from "@/staff/staffStorage.web";
import { loadContacts } from "@/contacts/contactStorage.web";
import { loadConsumables } from "@/consumables/consumableStorage.web";
import { loadWorkPatterns, loadLeave, loadShifts, loadRotaSettings } from "@/planner/plannerStorage.web";
import { loadBookkeeping } from "@/bookkeeping/bookkeepingStorage.web";

// The one rule that matters here, for every provider that saves a whole
// list back to the server: "the server says there are none" and "we
// couldn't read them" must never look the same. Each provider treats an
// empty answer as "nothing there yet" and its next ordinary save writes
// over whatever the server has, so conflating them once cost a dealer
// their real stock (see inventoryStorage.web.ts) and the same shape
// existed in every module below.

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function calledUrls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map(call => String(call[0]));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const LIST_LOADERS: [string, () => Promise<unknown[] | null>, string][] = [
  ["loadJobs", loadJobs, "/jobs"],
  ["loadLeads", loadLeads, "/leads"],
  ["loadStaff", loadStaff, "/staff"],
  ["loadContacts", loadContacts, "/contacts"],
  ["loadConsumables", loadConsumables, "/consumables"],
  ["loadWorkPatterns", loadWorkPatterns, "/work-patterns"],
  ["loadLeave", loadLeave, "/leave"],
  ["loadShifts", loadShifts, "/shifts"],
];

describe.each(LIST_LOADERS)("%s", (_name, load, path) => {
  it("returns the items (from the right endpoint) when the server has some", async () => {
    const fetchMock = respond(200, { ok: true, items: [{ id: "a" }, { id: "b" }] });
    vi.stubGlobal("fetch", fetchMock);
    expect(await load()).toEqual([{ id: "a" }, { id: "b" }]);
    expect(calledUrls(fetchMock)).toHaveLength(1);
    expect(calledUrls(fetchMock)[0]).toMatch(new RegExp(`${path}$`));
  });

  it("returns an empty array only when the server successfully says the list is empty", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true, items: [] }));
    expect(await load()).toEqual([]);
  });

  it("returns null — not an empty list — when the connection drops", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await load()).toBeNull();
  });

  it.each([
    [401, { ok: false, error: "Invalid or expired session" }],
    [402, { ok: false, error: "Your trial has ended" }],
    [403, { ok: false, error: "awaiting approval" }],
    [500, { ok: false, error: "boom" }],
  ])("returns null when the server answers %i", async (status, body) => {
    vi.stubGlobal("fetch", respond(status, body));
    expect(await load()).toBeNull();
  });

  it("returns null for a 200 whose body isn't a list", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true }));
    expect(await load()).toBeNull();
    vi.stubGlobal("fetch", respond(200, { ok: true, items: "nope" }));
    expect(await load()).toBeNull();
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
    expect(await load()).toBeNull();
  });
});

describe("loadBookkeeping", () => {
  const FULL_DOC = {
    ok: true,
    costs: [{ id: "c1" }],
    purchases: [{ id: "p1" }],
    sales: [{ id: "s1" }],
    transactions: [{ id: "t1" }],
    suppliers: [{ id: "u1" }],
    categories: [{ id: "g1" }],
  };

  it("returns the whole ledger when the server has one", async () => {
    vi.stubGlobal("fetch", respond(200, FULL_DOC));
    expect(await loadBookkeeping()).toEqual({
      costs: [{ id: "c1" }],
      purchases: [{ id: "p1" }],
      sales: [{ id: "s1" }],
      transactions: [{ id: "t1" }],
      suppliers: [{ id: "u1" }],
      categories: [{ id: "g1" }],
    });
  });

  it("returns an empty ledger only when the server successfully sends six empty lists", async () => {
    vi.stubGlobal(
      "fetch",
      respond(200, { ok: true, costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [] })
    );
    expect(await loadBookkeeping()).toEqual({
      costs: [],
      purchases: [],
      sales: [],
      transactions: [],
      suppliers: [],
      categories: [],
    });
  });

  it("returns null — not an empty ledger — when the connection drops", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await loadBookkeeping()).toBeNull();
  });

  it.each([
    [401, { ok: false, error: "Invalid or expired session" }],
    [402, { ok: false, error: "Your trial has ended" }],
    [403, { ok: false, error: "awaiting approval" }],
    [500, { ok: false, error: "boom" }],
  ])("returns null when the server answers %i", async (status, body) => {
    vi.stubGlobal("fetch", respond(status, body));
    expect(await loadBookkeeping()).toBeNull();
  });

  it("returns null for a 200 that says ok:false", async () => {
    vi.stubGlobal("fetch", respond(200, { ...FULL_DOC, ok: false }));
    expect(await loadBookkeeping()).toBeNull();
  });

  it("returns null when any of the six lists is missing or isn't a list", async () => {
    const { categories: _dropped, ...withoutCategories } = FULL_DOC;
    vi.stubGlobal("fetch", respond(200, withoutCategories));
    expect(await loadBookkeeping()).toBeNull();
    vi.stubGlobal("fetch", respond(200, { ...FULL_DOC, sales: "nope" }));
    expect(await loadBookkeeping()).toBeNull();
    vi.stubGlobal("fetch", respond(200, { ok: true }));
    expect(await loadBookkeeping()).toBeNull();
  });
});

describe("loadRotaSettings", () => {
  const SETTINGS = { openDays: ["mon", "tue"], openTime: "08:30", closeTime: "17:30" };

  it("returns the saved settings", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true, settings: SETTINGS }));
    expect(await loadRotaSettings()).toEqual(SETTINGS);
  });

  it("returns null — not invented default hours — when the connection drops", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await loadRotaSettings()).toBeNull();
  });

  it.each([401, 402, 403, 500])("returns null when the server answers %i", async status => {
    vi.stubGlobal("fetch", respond(status, { ok: false, error: "no" }));
    expect(await loadRotaSettings()).toBeNull();
  });

  it("returns null for a 200 without usable settings", async () => {
    vi.stubGlobal("fetch", respond(200, { ok: true }));
    expect(await loadRotaSettings()).toBeNull();
    vi.stubGlobal("fetch", respond(200, { ok: true, settings: { openTime: "09:00" } }));
    expect(await loadRotaSettings()).toBeNull();
  });
});

// deleteStaff re-reads the roster, filters, and saves it back, so a failed
// read taken for an empty roster would save an empty roster.
describe("deleteStaff", () => {
  it("saves nothing when the current roster can't be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await deleteStaff("s1")).toBeNull();
    expect(fetchMock.mock.calls.every(call => (call[1] as RequestInit | undefined)?.method !== "PUT")).toBe(true);
  });

  it("saves the roster without the removed record when it can be read", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, items: init?.method === "PUT" ? [] : [{ id: "s1" }, { id: "s2" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await deleteStaff("s1")).toEqual([{ id: "s2" }]);
    const put = fetchMock.mock.calls.find(call => (call[1] as RequestInit | undefined)?.method === "PUT");
    expect(JSON.parse(String((put?.[1] as RequestInit).body))).toEqual({ items: [{ id: "s2" }] });
  });
});
