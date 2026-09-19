import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL providers (bookkeeping, jobs, leads, contacts, consumables,
// staff, rota) through a stand-in for React's hooks (see lib/testing/
// hookRuntime.ts), against a fake server that behaves like the real API:
// GET returns what is stored, PUT REPLACES the stored list with the body.
//
// The rule under test: a load that FAILED must never be mistaken for "the
// dealer has nothing", because most providers save by replacing the whole
// list with what is in memory. So after a failed load, an ordinary edit must
// send NO whole-list save and leave the server's records exactly as they
// were. This is the layer between the storage modules (tested in
// storageLoaders.test.ts) and the server (tested in the backend's
// wholeListGuards.test.ts): the glue that decides whether to save.

const auth = vi.hoisted(() => ({ user: null as { dealershipId: string } | null }));

vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  const runtime = await import("@/lib/testing/hookRuntime");
  const base = (actual as unknown as { default?: object }).default ?? actual;
  const patched = {
    ...base,
    useState: runtime.useState,
    useEffect: runtime.useEffect,
    useRef: runtime.useRef,
    useCallback: runtime.useCallback,
    useMemo: runtime.useMemo,
  };
  return { ...patched, default: patched };
});
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/features/dealer-notifications/DealerNotificationsContext", () => ({
  useDealerNotifications: () => ({ addNotification: () => {} }),
}));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { BASE_URL } from "@/lib/apiBaseUrl";
import { getLoadFailures } from "@/lib/loadFailures";
import { BookkeepingProvider } from "@/bookkeeping/BookkeepingProvider";
import { JobsProvider } from "@/context/JobsContext";
import { LeadsProvider } from "@/context/LeadsContext";
import { ContactsProvider } from "@/context/ContactsContext";
import { ConsumablesProvider } from "@/context/ConsumablesContext";
import { StaffProvider } from "@/staff/StaffContext";
import { PlannerProvider } from "@/context/PlannerContext";

/* ------------------------------ fake server ------------------------------ */

type Failure = "html502" | "network" | "json500" | "expired";

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function failureReply(mode: Failure) {
  switch (mode) {
    case "network":
      throw new TypeError("Failed to fetch");
    case "html502":
      // A proxy's HTML error page: the status is bad and the body isn't JSON.
      return {
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token '<'");
        },
      };
    case "json500":
      return reply(500, { ok: false, error: "Internal error" });
    case "expired":
      return reply(401, { ok: false, error: "Invalid or expired session" });
  }
}

const LIST_PATHS = ["/jobs", "/leads", "/staff", "/contacts", "/consumables", "/work-patterns", "/leave", "/shifts"];
const EMPTY_LEDGER = { costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [] };
const DEFAULT_ROTA = { openDays: ["mon", "tue"], openTime: "09:00", closeTime: "18:00" };

interface Call {
  method: string;
  path: string;
  body: any;
}

class FakeServer {
  readonly data = new Map<string, any>();
  readonly calls: Call[] = [];
  private failures: { method: string; path: string; mode: Failure }[] = [];
  private holds: { method: string; path: string; gate: Promise<void> }[] = [];

  failNext(path: string, mode: Failure, method = "GET") {
    this.failures.push({ method, path, mode });
  }

  // The next request for this path waits until release() is called.
  hold(path: string, method = "GET") {
    let release = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    this.holds.push({ method, path, gate });
    return release;
  }

  puts(path?: string): Call[] {
    return this.calls.filter(c => c.method === "PUT" && (path === undefined || c.path === path));
  }

  fetch = async (input: unknown, init?: { method?: string; body?: unknown }): Promise<any> => {
    const method = (init?.method ?? "GET").toUpperCase();
    const path = String(input).replace(BASE_URL, "");
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    this.calls.push({ method, path, body });

    const failure = this.failures.findIndex(f => f.method === method && f.path === path);
    if (failure >= 0) {
      const [hit] = this.failures.splice(failure, 1);
      return failureReply(hit!.mode);
    }
    const held = this.holds.findIndex(h => h.method === method && h.path === path);
    if (held >= 0) {
      // A slow GET answers with what the server held when it was ASKED, however
      // late the answer arrives (like a real slow response).
      const answer = this.handle(method, path, body);
      const [hit] = this.holds.splice(held, 1);
      await hit!.gate;
      return answer;
    }
    return this.handle(method, path, body);
  };

  private handle(method: string, path: string, body: any) {
    if (method === "GET" && LIST_PATHS.includes(path)) return reply(200, { ok: true, items: this.data.get(path) ?? [] });
    if (method === "GET" && path === "/bookkeeping") return reply(200, { ok: true, ...EMPTY_LEDGER, ...(this.data.get(path) ?? {}) });
    if (method === "GET" && path === "/rota-settings") return reply(200, { ok: true, settings: this.data.get(path) ?? DEFAULT_ROTA });

    if (method === "PUT" && LIST_PATHS.includes(path)) {
      if (!Array.isArray(body?.items)) return reply(400, { ok: false, error: "items must be an array" });
      this.data.set(path, body.items);
      return reply(200, { ok: true, items: body.items });
    }
    if (method === "PUT" && path === "/bookkeeping") {
      this.data.set(path, body);
      return reply(200, { ok: true, ...body });
    }
    if (method === "PUT" && path === "/rota-settings") {
      this.data.set(path, body);
      return reply(200, { ok: true, settings: body });
    }
    // Per-item creates append on the server, like the real routes do.
    if (method === "POST" && (path === "/contacts" || path === "/consumables")) {
      const entry = { id: `${path.slice(1)}-created`, ...body, updatedAt: "2030-01-01T00:00:00.000Z" };
      this.data.set(path, [...(this.data.get(path) ?? []), entry]);
      return reply(200, { ok: true, entry });
    }
    return reply(404, { ok: false, error: `unhandled ${method} ${path}` });
  }
}

/* ------------------------------ test plumbing ----------------------------- */

// Let every pending promise and every batched re-render finish.
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

let server: FakeServer;
let mounted: Mounted<{ children?: unknown }, any> | null = null;

beforeEach(() => {
  server = new FakeServer();
  auth.user = { dealershipId: "dealer-a" };
  vi.stubGlobal("fetch", server.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  auth.user = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function open(spec: Spec) {
  mounted = mount(spec.Provider as (props: { children?: unknown }) => unknown, { children: null }) as Mounted<
    { children?: unknown },
    any
  >;
  await settle();
  return mounted;
}

// What the provider's consumers would get from useX(), from the latest render.
const ctx = () => mounted!.result.props.value as any;

/* ---------------------------- sample records ---------------------------- */

const cost = (id: string) => ({
  id,
  vehicleId: "v1",
  type: "parts",
  amount: 120,
  vatRate: 0.2,
  vatIncluded: true,
  vatReclaimable: true,
  vatAmount: 0,
  netAmount: 0,
  date: "2030-01-05",
});
const purchase = (id: string) => ({
  id,
  vehicleId: "v9",
  purchasePrice: 4000,
  date: "2030-01-01",
  vatRate: 0.2,
  vatIncluded: false,
  vatAmount: 0,
  netAmount: 0,
});
const sale = (id: string) => ({
  id,
  vehicleId: "v9",
  salePrice: 5200,
  invoiceNumber: "INV-1",
  date: "2030-02-01",
  vatScheme: "standard",
  vatRate: 0.2,
  vatIncluded: true,
  vatAmount: 0,
  netAmount: 0,
});
const LEDGER = {
  costs: [cost("c1"), cost("c2")],
  purchases: [purchase("p1")],
  sales: [sale("s1")],
  transactions: [{ id: "t1", amount: 50 }],
  suppliers: [{ id: "u1", name: "Parts Ltd" }],
  categories: [{ id: "g1", name: "Repairs" }],
};
const job = (id: string) => ({ id, title: `Job ${id}`, status: "todo", priority: "high", createdAt: "2030-01-01", createdByName: "T" });
const lead = (id: string) => ({ id, name: `Lead ${id}`, source: "web", createdAt: "2030-01-01" });
const contact = (id: string) => ({ id, name: `Contact ${id}`, category: "other", updatedAt: "2030-01-01" });
const consumable = (id: string) => ({ id, name: `Item ${id}`, currentStock: 4, reorderThreshold: 1, updatedAt: "2030-01-01" });
const staffRecord = (id: string) => ({ id, name: `Staff ${id}`, role: "Technician" });
const pattern = (userId: string) => ({
  userId,
  userName: `User ${userId}`,
  employmentType: "full_time",
  targetWeeklyHours: 40,
  availableDays: ["mon", "tue"],
  holidayEntitlementDays: 28,
});
const shift = (id: string) => ({
  id,
  userId: "u1",
  userName: "User u1",
  date: "2030-01-07",
  start: "09:00",
  end: "17:00",
  autoGenerated: false,
  createdAt: "2030-01-01",
});

/* -------------------------------- the table ------------------------------- */

interface Spec {
  name: string;
  Provider: unknown;
  // What the shared banner calls it (the useGuardedLoad id).
  bannerId: string;
  // Every path the provider must read successfully before it may save.
  reads: string[];
  // The whole-list save endpoints it can write.
  saves: string[];
  seed: (s: FakeServer) => void;
  // The records the provider is holding in memory (what its screens show).
  memory: (c: any) => unknown[];
  // Ordinary edits that end in a whole-list save. Each one is run on its own.
  edits: [string, (c: any) => unknown][];
  // The one edit used to show a normal save still works, and what it stores.
  primary: string;
  expectPrimaryStored: (s: FakeServer) => void;
}

const SPECS: Spec[] = [
  {
    name: "bookkeeping",
    Provider: BookkeepingProvider,
    bannerId: "bookkeeping",
    reads: ["/bookkeeping"],
    saves: ["/bookkeeping"],
    seed: s => s.data.set("/bookkeeping", structuredClone(LEDGER)),
    memory: c => [...c.costs, ...c.purchases, ...c.sales, ...c.transactions, ...c.suppliers, ...c.categories],
    edits: [
      ["addCost", c => c.addCost(cost("c-new"))],
      ["updateCost", c => c.updateCost("c1", { amount: 130 })],
      ["deleteCost", c => c.deleteCost("c1")],
      ["addPurchase", c => c.addPurchase(purchase("p-new"))],
      ["addSale", c => c.addSale(sale("s-new"))],
      ["addTransaction", c => c.addTransaction({ id: "t-new", amount: 5 })],
      ["addSupplier", c => c.addSupplier({ id: "u-new", name: "New Supplier" })],
      ["addCategory", c => c.addCategory({ id: "g-new", name: "New Category" })],
    ],
    primary: "addCost",
    expectPrimaryStored: s => {
      const stored = s.data.get("/bookkeeping");
      // The whole ledger came back, with the one new cost added to it.
      expect(stored.costs.map((x: any) => x.id)).toEqual(["c1", "c2", "c-new"]);
      expect(stored.purchases).toHaveLength(1);
      expect(stored.sales).toHaveLength(1);
      expect(stored.transactions).toHaveLength(1);
      expect(stored.suppliers).toHaveLength(1);
      expect(stored.categories).toHaveLength(1);
    },
  },
  {
    name: "jobs",
    Provider: JobsProvider,
    bannerId: "jobs",
    reads: ["/jobs"],
    saves: ["/jobs"],
    seed: s => s.data.set("/jobs", [job("j1"), job("j2"), job("j3")]),
    memory: c => c.jobs,
    edits: [
      ["addJob", c => c.addJob(job("j-new"))],
      ["updateJob", c => c.updateJob({ ...job("j1"), status: "done" })],
      ["removeJob", c => c.removeJob("j1")],
    ],
    primary: "addJob",
    expectPrimaryStored: s => expect(s.data.get("/jobs").map((x: any) => x.id)).toEqual(["j1", "j2", "j3", "j-new"]),
  },
  {
    name: "leads",
    Provider: LeadsProvider,
    bannerId: "leads",
    reads: ["/leads"],
    saves: ["/leads"],
    seed: s => s.data.set("/leads", [lead("l1"), lead("l2"), lead("l3")]),
    memory: c => c.leads,
    edits: [
      ["addLead", c => c.addLead(lead("l-new"))],
      ["updateLead", c => c.updateLead({ ...lead("l1"), name: "Renamed" })],
      ["removeLead", c => c.removeLead("l1")],
    ],
    primary: "addLead",
    expectPrimaryStored: s => expect(s.data.get("/leads").map((x: any) => x.id)).toEqual(["l1", "l2", "l3", "l-new"]),
  },
  {
    name: "contacts",
    Provider: ContactsProvider,
    bannerId: "contacts",
    reads: ["/contacts"],
    saves: ["/contacts"],
    seed: s => s.data.set("/contacts", [contact("k1"), contact("k2")]),
    memory: c => c.contacts,
    edits: [["updateContact", c => c.updateContact("k1", { notes: "call back" })]],
    primary: "updateContact",
    expectPrimaryStored: s => {
      const stored = s.data.get("/contacts");
      expect(stored.map((x: any) => x.id)).toEqual(["k1", "k2"]);
      expect(stored[0].notes).toBe("call back");
    },
  },
  {
    name: "consumables",
    Provider: ConsumablesProvider,
    bannerId: "consumables",
    reads: ["/consumables"],
    saves: ["/consumables"],
    seed: s => s.data.set("/consumables", [consumable("m1"), consumable("m2")]),
    memory: c => c.consumables,
    edits: [
      ["updateConsumable", c => c.updateConsumable("m1", { notes: "recounted" })],
      ["updateStock", c => c.updateStock("m1", 9)],
      [
        "importConsumables",
        // Throws when nothing was saved, so the import screen can't claim success.
        async c => {
          try {
            await c.importConsumables([{ name: "Imported", currentStock: 1, reorderThreshold: 1 }]);
          } catch {
            /* refused, as intended */
          }
        },
      ],
    ],
    primary: "updateStock",
    expectPrimaryStored: s => {
      const stored = s.data.get("/consumables");
      expect(stored.map((x: any) => x.id)).toEqual(["m1", "m2"]);
      expect(stored[0].currentStock).toBe(9);
    },
  },
  {
    name: "staff",
    Provider: StaffProvider,
    bannerId: "staff",
    reads: ["/staff"],
    saves: ["/staff"],
    seed: s => s.data.set("/staff", [staffRecord("t1"), staffRecord("t2")]),
    memory: c => c.staff,
    edits: [
      ["addStaff", c => c.addStaff(staffRecord("t-new"))],
      ["updateStaff", c => c.updateStaff({ ...staffRecord("t1"), role: "Manager" })],
      ["removeStaff", c => c.removeStaff("t1")],
    ],
    primary: "addStaff",
    expectPrimaryStored: s => expect(s.data.get("/staff").map((x: any) => x.id)).toEqual(["t1", "t2", "t-new"]),
  },
  {
    name: "rota",
    Provider: PlannerProvider,
    bannerId: "rota",
    reads: ["/work-patterns", "/leave", "/shifts", "/rota-settings"],
    saves: ["/work-patterns", "/shifts", "/rota-settings"],
    seed: s => {
      s.data.set("/work-patterns", [pattern("u1")]);
      s.data.set("/leave", []);
      s.data.set("/shifts", [shift("h1"), shift("h2")]);
      s.data.set("/rota-settings", { openDays: ["mon", "tue", "wed"], openTime: "08:30", closeTime: "17:30" });
    },
    memory: c => [...c.workPatterns, ...c.shifts],
    edits: [
      ["saveWorkPattern", c => c.saveWorkPattern(pattern("u2"))],
      ["removeWorkPattern", c => c.removeWorkPattern("u1")],
      ["updateRotaSettings", c => c.updateRotaSettings({ openDays: ["sat"], openTime: "10:00", closeTime: "16:00" })],
      ["saveShift", c => c.saveShift(shift("h-new"))],
      ["removeShift", c => c.removeShift("h1")],
    ],
    primary: "saveShift",
    expectPrimaryStored: s => {
      expect(s.data.get("/shifts").map((x: any) => x.id)).toEqual(["h1", "h2", "h-new"]);
      // Nothing else in the rota was touched.
      expect(s.data.get("/work-patterns")).toHaveLength(1);
      expect(s.data.get("/rota-settings").openTime).toBe("08:30");
    },
  },
];

function snapshot(spec: Spec) {
  return structuredClone(Object.fromEntries(spec.saves.map(path => [path, server.data.get(path)])));
}

const FAILURES: Failure[] = ["html502", "network", "json500", "expired"];

function editOf(spec: Spec, name: string) {
  const found = spec.edits.find(([label]) => label === name);
  if (!found) throw new Error(`${spec.name} has no edit called ${name}`);
  return found[1];
}

describe.each(SPECS)("$name: a failed load is never taken for an empty list", spec => {
  it("loads the server's records and saves the whole list back with an edit when the load worked", async () => {
    spec.seed(server);
    await open(spec);
    expect(getLoadFailures().map(f => f.id)).not.toContain(spec.bannerId);

    await editOf(spec, spec.primary)(ctx());
    await settle();

    expect(server.puts().length).toBeGreaterThan(0);
    spec.expectPrimaryStored(server);
  });

  it.each(spec.edits)("after the first load failed with a bad gateway page, %s sends no save and the stored records stay as they were", async (_name, edit) => {
    spec.seed(server);
    const before = snapshot(spec);
    server.failNext(spec.reads[0]!, "html502");

    await open(spec);
    await edit(ctx());
    await settle();

    expect(server.puts(), "no whole-list save may be sent").toEqual([]);
    expect(snapshot(spec)).toEqual(before);
  });

  it.each(FAILURES)("after the first load failed (%s), the primary edit sends no save and the stored records stay as they were", async mode => {
    spec.seed(server);
    const before = snapshot(spec);
    server.failNext(spec.reads[0]!, mode);

    await open(spec);
    await editOf(spec, spec.primary)(ctx());
    await settle();

    expect(server.puts()).toEqual([]);
    expect(snapshot(spec)).toEqual(before);
  });

  it("says which data could not be loaded, then saves normally once Try again has worked", async () => {
    spec.seed(server);
    server.failNext(spec.reads[0]!, "network");

    await open(spec);
    const entry = getLoadFailures().find(f => f.id === spec.bannerId);
    expect(entry, "the failure is reported to the shared banner").toBeDefined();
    if ("loading" in ctx()) expect(ctx().loading).toBe(false);

    await entry!.retry();
    await settle();
    expect(getLoadFailures().map(f => f.id)).not.toContain(spec.bannerId);

    await editOf(spec, spec.primary)(ctx());
    await settle();
    spec.expectPrimaryStored(server);
  });

  it("keeps the banner up, and keeps refusing to save, when Try again fails too", async () => {
    spec.seed(server);
    const before = snapshot(spec);
    server.failNext(spec.reads[0]!, "network");
    server.failNext(spec.reads[0]!, "html502");

    await open(spec);
    await getLoadFailures().find(f => f.id === spec.bannerId)!.retry();
    await settle();
    expect(getLoadFailures().map(f => f.id)).toContain(spec.bannerId);

    await editOf(spec, spec.primary)(ctx());
    await settle();
    expect(server.puts()).toEqual([]);
    expect(snapshot(spec)).toEqual(before);
  });

  it("refuses an edit made while the first load is still on its way", async () => {
    spec.seed(server);
    const before = snapshot(spec);
    const release = server.hold(spec.reads[0]!);

    await open(spec);
    await editOf(spec, spec.primary)(ctx());
    await settle();
    expect(server.puts()).toEqual([]);

    release();
    await settle();
    expect(snapshot(spec)).toEqual(before);
  });

  it("does not save the previous login's records into a different dealership's account", async () => {
    spec.seed(server);
    await open(spec);

    // A different dealership logs in over the same tab; its data is slow.
    auth.user = { dealershipId: "dealer-b" };
    const release = server.hold(spec.reads[0]!);
    mounted!.rerender();
    await settle();
    const before = snapshot(spec);

    await editOf(spec, spec.primary)(ctx());
    await settle();
    expect(server.puts(), "the old login's data must not be written").toEqual([]);
    expect(snapshot(spec)).toEqual(before);

    release();
    await settle();
  });

  it("drops the previous login's records from memory when a different dealership logs in", async () => {
    spec.seed(server);
    await open(spec);
    expect(spec.memory(ctx()).length).toBeGreaterThan(0);

    auth.user = { dealershipId: "dealer-b" };
    const release = server.hold(spec.reads[0]!);
    mounted!.rerender();
    await settle();
    expect(spec.memory(ctx())).toEqual([]);

    release();
    await settle();
  });

  it("does not treat a newly logged-in dealership whose first load failed as if it had loaded", async () => {
    spec.seed(server);
    await open(spec); // the first dealership loaded fine

    auth.user = { dealershipId: "dealer-b" };
    server.failNext(spec.reads[0]!, "html502");
    mounted!.rerender();
    await settle();
    const before = snapshot(spec);
    expect(getLoadFailures().map(f => f.id)).toContain(spec.bannerId);

    await editOf(spec, spec.primary)(ctx());
    await settle();
    expect(server.puts()).toEqual([]);
    expect(snapshot(spec)).toEqual(before);
  });

  it("ignores a slow answer for the previous login that arrives after a different dealership has logged in", async () => {
    spec.seed(server);
    const releaseSlowAnswer = server.hold(spec.reads[0]!); // dealer A's answer, carrying A's records
    await open(spec);

    // Dealer B logs in and has nothing yet; B's own load answers straight away.
    server.data.clear();
    auth.user = { dealershipId: "dealer-b" };
    mounted!.rerender();
    await settle();
    expect(spec.memory(ctx())).toEqual([]);

    releaseSlowAnswer();
    await settle();
    expect(spec.memory(ctx()), "A's late answer must not land on B's screen").toEqual([]);
  });

  it("still saves when the server genuinely says the dealer has nothing yet", async () => {
    // Nothing seeded: every read succeeds and returns an empty list.
    await open(spec);
    expect(getLoadFailures().map(f => f.id)).not.toContain(spec.bannerId);

    await editOf(spec, spec.primary)(ctx());
    await settle();
    expect(server.puts().length).toBeGreaterThan(0);
  });
});

describe("bookkeeping: editing a sale after a good load saves the whole ledger with the change", () => {
  it("re-saves every list, with the buyer added to the one sale", async () => {
    const spec = SPECS.find(s => s.name === "bookkeeping")!;
    spec.seed(server);
    await open(spec);

    await ctx().updateSale("s1", { buyer: "Pat Buyer" });
    await settle();

    const stored = server.data.get("/bookkeeping");
    expect(stored.sales).toHaveLength(1);
    expect(stored.sales[0].buyer).toBe("Pat Buyer");
    expect(stored.costs).toHaveLength(2);
    expect(stored.purchases).toHaveLength(1);
  });
});

describe("rota: any one of its four reads failing blocks every save", () => {
  const spec = SPECS.find(s => s.name === "rota")!;

  it.each(spec.reads)("when %s fails", async path => {
    spec.seed(server);
    const before = snapshot(spec);
    server.failNext(path, "html502");

    await open(spec);
    expect(getLoadFailures().map(f => f.id)).toContain("rota");

    for (const [, edit] of spec.edits) {
      const result = await edit(ctx());
      // A refused save comes back as a message for the screen to show.
      expect(typeof result).toBe("string");
    }
    await settle();
    expect(server.puts()).toEqual([]);
    expect(snapshot(spec)).toEqual(before);
  });
});

describe("leads and staff re-read the server before every save; a failed re-read saves nothing", () => {
  it("leads: the re-read inside addLead fails, so the lead is not saved and the leads survive", async () => {
    const spec = SPECS.find(s => s.name === "leads")!;
    spec.seed(server);
    await open(spec);
    const before = snapshot(spec);

    server.failNext("/leads", "html502"); // the re-read, not the first load
    const saved = await ctx().addLead(lead("l-new"));
    await settle();

    expect(saved).toBe(false);
    expect(server.puts()).toEqual([]);
    expect(snapshot(spec)).toEqual(before);
  });

  it("leads: every write (add, update, remove) refuses when its re-read fails", async () => {
    const spec = SPECS.find(s => s.name === "leads")!;
    spec.seed(server);
    await open(spec);
    const before = snapshot(spec);

    for (const [, edit] of spec.edits) {
      server.failNext("/leads", "network");
      expect(await edit(ctx())).toBe(false);
    }
    expect(server.puts()).toEqual([]);
    expect(snapshot(spec)).toEqual(before);
  });

  it("leads: a re-read that fails is not taken for an empty list even when the network drops", async () => {
    const spec = SPECS.find(s => s.name === "leads")!;
    spec.seed(server);
    await open(spec);
    const before = snapshot(spec);

    server.failNext("/leads", "network");
    await ctx().removeLead("l1");
    expect(server.puts()).toEqual([]);
    expect(snapshot(spec)).toEqual(before);
  });

  it("staff: every write refuses when its re-read fails", async () => {
    const spec = SPECS.find(s => s.name === "staff")!;
    spec.seed(server);
    await open(spec);
    const before = snapshot(spec);

    for (const [, edit] of spec.edits) {
      server.failNext("/staff", "html502");
      const result = await edit(ctx());
      expect(typeof result).toBe("string"); // an error message for the screen
    }
    expect(server.puts()).toEqual([]);
    expect(snapshot(spec)).toEqual(before);
  });

  it("leads and staff still save when the re-read works", async () => {
    for (const name of ["leads", "staff"]) {
      const spec = SPECS.find(s => s.name === name)!;
      server.data.clear();
      server.calls.length = 0;
      spec.seed(server);
      const opened = await open(spec);
      await editOf(spec, spec.primary)(ctx());
      await settle();
      spec.expectPrimaryStored(server);
      opened.unmount();
    }
  });
});

describe("contacts and consumables: adding is a safe per-item save, but the edit after it must not replace the rest", () => {
  it("contacts: after a failed load, adding a contact and then editing it leaves the real contacts alone", async () => {
    const spec = SPECS.find(s => s.name === "contacts")!;
    spec.seed(server);
    server.failNext("/contacts", "html502");

    await open(spec);
    const error = await ctx().addContact({ name: "Fresh Contact", category: "other" });
    await settle();
    expect(error).toBeNull(); // adding is a server-side append, so it is allowed
    expect(server.data.get("/contacts")).toHaveLength(3);

    const saved = await ctx().updateContact("contacts-created", { notes: "edited" });
    await settle();
    expect(saved).toBe(false);
    expect(server.puts()).toEqual([]);
    expect(server.data.get("/contacts").map((c: any) => c.id)).toEqual(["k1", "k2", "contacts-created"]);
  });

  it("consumables: after a failed load, adding an item and then editing its stock leaves the real items alone", async () => {
    const spec = SPECS.find(s => s.name === "consumables")!;
    spec.seed(server);
    server.failNext("/consumables", "html502");

    await open(spec);
    const error = await ctx().addConsumable({ name: "Fresh Item", currentStock: 1, reorderThreshold: 1 });
    await settle();
    expect(error).toBeNull();
    expect(server.data.get("/consumables")).toHaveLength(3);

    const saved = await ctx().updateStock("consumables-created", 5);
    await settle();
    expect(saved).toBe(false);
    expect(server.puts()).toEqual([]);
    expect(server.data.get("/consumables").map((c: any) => c.id)).toEqual(["m1", "m2", "consumables-created"]);
  });
});

describe("a login that is not there yet", () => {
  it.each(SPECS.map(s => [s.name, s] as const))("%s: reads nothing and saves nothing while nobody is logged in", async (_name, spec) => {
    auth.user = null;
    spec.seed(server);
    const before = snapshot(spec);

    await open(spec);
    await editOf(spec, spec.primary)(ctx());
    await settle();

    expect(server.calls).toEqual([]);
    expect(snapshot(spec)).toEqual(before);
  });
});
