import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL bookkeeping provider (through the stand-in for React's hooks in
// lib/testing/hookRuntime.ts) against a fake server that holds a ledger, then
// shows what the two ledger screens print for it.
//
// The bug: a car bought with a price that could not be read (saved as 0 or
// nothing) and later sold for 5,000 showed a profit of 5,000 and a 100% margin;
// a sale saved at 0 printed "-Infinity%"; a car bought and sold at 0 printed
// "NaN%"; and a car with no worked-out profit was shown as "£0, 0.0%".

const ledger = vi.hoisted(() => ({
  doc: { costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [] } as Record<string, any[]>,
  provider: null as any,
}));

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
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { dealershipId: "dealer-a" } }) }));
// The screens read the ledger from the LIVE provider mounted below.
vi.mock("@/bookkeeping/BookkeepingProvider", async importOriginal => {
  const actual = await importOriginal<typeof import("@/bookkeeping/BookkeepingProvider")>();
  return { ...actual, useBookkeeping: () => ledger.provider.result.props.value };
});
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({ vehicles: [{ id: "v1", make: "Ford", model: "Focus" }] }),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => () => {},
  useParams: () => ({ vehicleId: "v1" }),
}));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { BookkeepingProvider } from "@/bookkeeping/BookkeepingProvider";
import BookkeepingTable from "@/bookkeeping/BookkeepingTable";
import BookkeepingEntryScreen from "@/bookkeeping/BookkeepingEntryScreen";

/* --------------------------- reading the element tree --------------------------- */

interface El {
  type: unknown;
  props: Record<string, any>;
}
const isElement = (node: unknown): node is El => typeof node === "object" && node !== null && "props" in node;
function textOf(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (isElement(node)) return textOf(node.props.children);
  return "";
}
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/* --------------------------------- plumbing --------------------------------- */

const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));
let mounted: Mounted<{ children?: unknown }, any> | null = null;
let screen: Mounted<any, any> | null = null;
let puts: any[];

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  puts = [];
  vi.stubGlobal("fetch", async (_url: unknown, init?: { method?: string; body?: string }) => {
    if ((init?.method ?? "GET").toUpperCase() === "PUT") {
      const body = JSON.parse(init!.body!);
      puts.push(body);
      ledger.doc = body;
      return reply(200, { ok: true, ...body });
    }
    return reply(200, { ok: true, ...ledger.doc });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  screen?.unmount();
  mounted?.unmount();
  screen = null;
  mounted = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// JSON cannot carry NaN (JSON.stringify turns it into null), so a saved-as-nothing
// price reaches the app as null. 0 is what a blank used to be saved as.
async function openLedger(doc: Partial<Record<string, any[]>>) {
  ledger.doc = { costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [], ...doc };
  mounted = mount(BookkeepingProvider as (p: { children?: unknown }) => unknown, { children: null }) as Mounted<
    { children?: unknown },
    any
  >;
  ledger.provider = mounted;
  await settle();
}
const ctx = () => mounted!.result.props.value as any;

const purchase = (purchasePrice: unknown) => ({
  id: "p1",
  vehicleId: "v1",
  purchasePrice,
  source: "Auction",
  date: "2026-03-01",
  vatRate: 0,
  vatIncluded: false,
  vatAmount: 0,
  netAmount: purchasePrice,
});
const sale = (salePrice: unknown) => ({
  id: "s1",
  vehicleId: "v1",
  salePrice,
  invoiceNumber: "INV-0001",
  date: "2026-03-10",
  vatScheme: "standard",
  vatRate: 0.2,
  vatIncluded: true,
  vatAmount: 0,
  netAmount: 0,
});
const cost = (amount: number) => ({ id: "c1", vehicleId: "v1", type: "parts", amount, date: "2026-03-05", vatRate: 0, vatIncluded: false, vatReclaimable: false, vatAmount: 0, netAmount: amount });

function rowText(): string {
  screen = mount(BookkeepingTable as (p: object) => unknown, {}) as Mounted<any, any>;
  const tbody = (function find(node: unknown): El | null {
    if (Array.isArray(node)) {
      for (const n of node) {
        const f = find(n);
        if (f) return f;
      }
      return null;
    }
    if (!isElement(node)) return null;
    if (node.type === "tbody") return node;
    return find(node.props.children);
  })(screen.result);
  // cells in order: Vehicle, Purchase, Total Cost, Sale, Profit, Margin, VAT Due, ...
  const cells: string[] = [];
  (function collect(node: unknown) {
    if (Array.isArray(node)) return node.forEach(collect);
    if (!isElement(node)) return;
    if (node.type === "td") cells.push(squash(textOf(node)));
    else collect(node.props.children);
  })(tbody);
  return cells.join(" | ");
}

/* ----------------------------------- tests ----------------------------------- */

describe("the provider's getProfitForVehicle", () => {
  it("works out profit and margin for a good purchase and sale (and costs)", async () => {
    await openLedger({ purchases: [purchase(4000)], sales: [sale(5000)], costs: [cost(300)] });
    const p = ctx().getProfitForVehicle("v1");
    expect(p.profit).toBe(700);
    expect(p.margin).toBeCloseTo(14, 10);
    expect(p.purchasePrice).toBe(4000);
    expect(p.totalCosts).toBe(300);
  });

  it.each([
    ["zero", 0],
    ["nothing saved (null)", null],
    ["negative", -4500],
  ])("purchase price %s: profit is unknown (null), not the whole sale price", async (_name, price) => {
    await openLedger({ purchases: [purchase(price)], sales: [sale(5000)] });
    expect(ctx().getProfitForVehicle("v1")).toBeNull();
    // and the hub agrees: left out and counted
    expect(ctx().getTotalProfit()).toBe(0);
  });

  it("no purchase at all is still unknown", async () => {
    await openLedger({ sales: [sale(5000)] });
    expect(ctx().getProfitForVehicle("v1")).toBeNull();
  });

  it("a sale saved at 0 gives a loss with a null margin, never -Infinity", async () => {
    await openLedger({ purchases: [purchase(4000)], sales: [sale(0)] });
    const p = ctx().getProfitForVehicle("v1");
    expect(p.profit).toBe(-4000);
    expect(p.margin).toBeNull();
  });

  it("bought and sold at 0 is unknown, not NaN", async () => {
    await openLedger({ purchases: [purchase(0)], sales: [sale(0)] });
    expect(ctx().getProfitForVehicle("v1")).toBeNull();
  });

  it("nothing is written back by reading (a load followed by no save)", async () => {
    await openLedger({ purchases: [purchase(0)], sales: [sale(5000)] });
    ctx().getProfitForVehicle("v1");
    await settle();
    expect(puts).toHaveLength(0);
  });
});

describe("the vehicle ledger table", () => {
  it("shows dashes, not £0 / -Infinity% / NaN%, for a car whose purchase price is not recorded", async () => {
    await openLedger({ purchases: [purchase(0)], sales: [sale(5000)] });
    const row = rowText();
    // Vehicle | Purchase | Total Cost | Sale | Profit | Margin | VAT Due | From | Date
    expect(row).toContain("Ford Focus | — | £0 | £5,000 | — | — |");
    expect(row).not.toMatch(/NaN|Infinity/);
  });

  it("shows the real profit and margin for a good car", async () => {
    await openLedger({ purchases: [purchase(4500)], sales: [sale(5000)] });
    expect(rowText()).toContain("Ford Focus | £4,500 | £0 | £5,000 | £500 | 10.0% |");
  });

  it("shows a loss and a dash for margin when the sale was saved at 0, never -Infinity%", async () => {
    await openLedger({ purchases: [purchase(4000)], sales: [sale(0)] });
    const row = rowText();
    expect(row).toContain("| -£4,000 | — |");
    expect(row).not.toMatch(/NaN|Infinity/);
  });

  it("shows dashes for a car bought and sold at 0, not NaN%", async () => {
    await openLedger({ purchases: [purchase(0)], sales: [sale(0)] });
    const row = rowText();
    expect(row).not.toMatch(/NaN|Infinity/);
    expect(row).toContain("Ford Focus | — |");
  });
});

describe("the single-vehicle ledger screen", () => {
  const text = () => {
    screen = mount(BookkeepingEntryScreen as (p: object) => unknown, {}) as Mounted<any, any>;
    return squash(textOf(screen.result));
  };

  it("says Profit — and Margin — with a reason, not £0 and 0.0%, when the purchase price is not recorded", async () => {
    await openLedger({ purchases: [purchase(0)], sales: [sale(5000)] });
    const t = text();
    expect(t).toContain("Price: Not recorded");
    expect(t).toContain("Profit: —");
    expect(t).toContain("Margin: —");
    expect(t).toContain("Profit is worked out once this car has a recorded purchase price above £0 and a sale.");
    expect(t).not.toContain("0.0%");
    expect(t).not.toMatch(/NaN|Infinity/);
  });

  it("says the same when there is a purchase but no sale yet", async () => {
    await openLedger({ purchases: [purchase(4000)] });
    const t = text();
    expect(t).toContain("Profit: —");
    expect(t).toContain("Margin: —");
  });

  it("shows profit and margin for a good car, with no explanation line", async () => {
    await openLedger({ purchases: [purchase(4500)], sales: [sale(5000)] });
    const t = text();
    expect(t).toContain("Price: £4,500");
    expect(t).toContain("Profit: £500");
    expect(t).toContain("Margin: 10.0%");
    expect(t).not.toContain("Profit is worked out once");
  });

  it("prints a dash for margin, not -Infinity%, when the sale was saved at 0", async () => {
    await openLedger({ purchases: [purchase(4000)], sales: [sale(0)] });
    const t = text();
    expect(t).toContain("Profit: -£4,000");
    expect(t).toContain("Margin: —");
    expect(t).not.toMatch(/NaN|Infinity/);
  });
});
