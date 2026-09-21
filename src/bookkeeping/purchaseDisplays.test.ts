import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL bookkeeping provider (through the hook stand-in) against a fake
// server that holds a ledger, then checks everything that shows or exports a
// purchase's VAT.
//
// A margin-scheme purchase has no VAT invoice, so nothing may show or export a
// VAT amount for it. Purchases saved before the fix carry phantom VAT (1,000 on a
// 6,000 purchase) and no scheme of their own: those are corrected IN MEMORY when
// shown, from the car's scheme, and the stored ledger is never rewritten.

const ledger = vi.hoisted(() => ({
  doc: {} as Record<string, any[]>,
  provider: null as any,
  vehicles: [] as any[],
  downloads: [] as { name: string; text: string }[],
}));

vi.mock("react", async (importOriginal) => {
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
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { dealershipId: "dealer-a", role: "owner" } }) }));
vi.mock("@/bookkeeping/BookkeepingProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/bookkeeping/BookkeepingProvider")>();
  return { ...actual, useBookkeeping: () => ledger.provider.result.props.value };
});
vi.mock("@/context/InventoryProvider", () => ({ useInventory: () => ({ vehicles: ledger.vehicles }) }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => () => {},
  useParams: () => ({ vehicleId: "v1", id: "Auction" }),
}));
vi.mock("@/tour/TourProvider", () => ({ useTour: () => ({ startTour: () => {} }) }));
vi.mock("@/lib/csv", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/csv")>();
  return { ...actual, downloadCSV: (name: string, text: string) => void ledger.downloads.push({ name, text }) };
});

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { findAll, screenText } from "@/lib/testing/elementTree";
import { BookkeepingProvider } from "@/bookkeeping/BookkeepingProvider";
import BookkeepingEntryScreen from "@/bookkeeping/BookkeepingEntryScreen";
import SupplierAnalytics from "@/bookkeeping/SupplierAnalytics";
import SupplierDetail from "@/bookkeeping/SupplierDetail";
import Settings from "@/dealer/settings/Settings";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
let mounted: Mounted<{ children?: unknown }, any> | null = null;
let screen: Mounted<any, any> | null = null;
let puts: any[];

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  puts = [];
  ledger.downloads = [];
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

async function openLedger(purchases: any[], vehicles: any[]) {
  ledger.doc = { costs: [], purchases, sales: [], transactions: [], suppliers: [], categories: [] };
  ledger.vehicles = vehicles;
  mounted = mount(BookkeepingProvider as (p: { children?: unknown }) => unknown, { children: null }) as Mounted<
    { children?: unknown },
    any
  >;
  ledger.provider = mounted;
  await settle();
}
const ctx = () => mounted!.result.props.value as any;
const show = (Screen: (p: any) => unknown) => {
  screen = mount(Screen, {}) as Mounted<any, any>;
  return screenText(screen.result);
};

// A margin purchase as the OLD forms saved it: 20% "included", 1,000 of VAT that never existed.
const phantom = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  vehicleId: "v1",
  purchasePrice: 6000,
  source: "Auction",
  date: "2026-03-01",
  vatRate: 0.2,
  vatIncluded: true,
  vatAmount: 1000,
  netAmount: 5000,
  ...over,
});
const marginCar = { id: "v1", make: "Ford", model: "Focus", vatScheme: "margin", mot: { expiry: "2030-01-01" } };
const standardCar = { id: "v2", make: "Audi", model: "A3", vatScheme: "standard", mot: { expiry: "2030-01-01" } };

describe("the vehicle ledger shows no VAT for a margin purchase", () => {
  it("an old purchase with phantom VAT reads 'None: bought under the Margin Scheme', with no VAT amount and no net line", async () => {
    await openLedger([phantom()], [marginCar]);
    const t = show(BookkeepingEntryScreen as (p: any) => unknown);
    expect(t).toContain("Price: £6,000");
    expect(t).toContain("VAT: None: bought under the Margin Scheme");
    expect(t).not.toContain("£1,000.00");
    expect(t).not.toContain("£5,000.00");
    expect(t).not.toContain("Net: £5,000");
  });

  it("a purchase saved with the fix (margin, no VAT) reads the same", async () => {
    await openLedger([phantom({ vatScheme: "margin", vatRate: 0, vatIncluded: false, vatAmount: 0, netAmount: 6000 })], [marginCar]);
    expect(show(BookkeepingEntryScreen as (p: any) => unknown)).toContain("VAT: None: bought under the Margin Scheme");
  });

  it("a real standard-scheme purchase still shows its VAT and net", async () => {
    await openLedger([phantom({ vehicleId: "v1" })], [{ ...marginCar, vatScheme: "standard" }]);
    const t = show(BookkeepingEntryScreen as (p: any) => unknown);
    expect(t).toContain("VAT: £1,000.00");
    expect(t).toContain("Net: £5,000.00");
    expect(t).not.toContain("Margin Scheme");
  });
});

describe("the supplier pages count no VAT for margin purchases", () => {
  it("Source detail: two 6,000 purchases from Auction, one margin one standard, count 1,000 of VAT, not 2,000", async () => {
    await openLedger(
      [phantom(), phantom({ id: "p2", vehicleId: "v2" })],
      [marginCar, standardCar]
    );
    const t = show(SupplierDetail as (p: any) => unknown);
    expect(t).toContain("VAT Impact £1,000.00");
    expect(t).not.toContain("£2,000.00");
  });

  it("Source detail: margin purchases only give £0.00 VAT impact", async () => {
    await openLedger([phantom(), phantom({ id: "p2", vehicleId: "v3" })], [marginCar, { ...marginCar, id: "v3" }]);
    expect(show(SupplierDetail as (p: any) => unknown)).toContain("VAT Impact £0.00");
  });

  it("Source analytics: the same, 1,000 not 2,000", async () => {
    await openLedger(
      [phantom(), phantom({ id: "p2", vehicleId: "v2" })],
      [marginCar, standardCar]
    );
    const t = show(SupplierAnalytics as (p: any) => unknown);
    expect(t).toContain("VAT Impact £1,000");
    expect(t).not.toContain("£2,000");
  });

  it("Source analytics: margin purchases only give £0", async () => {
    await openLedger([phantom()], [marginCar]);
    const t = show(SupplierAnalytics as (p: any) => unknown);
    expect(t).toContain("VAT Impact £0");
    expect(t).not.toContain("£1,000");
  });
});

describe("the purchases CSV export carries no VAT for a margin purchase", () => {
  async function exportPurchases() {
    screen = mount(Settings as (p: any) => unknown, {}) as Mounted<any, any>;
    const button = findAll(screen.result, (el) => typeof el.props.label === "string" && el.props.label.startsWith("Purchases ("))[0];
    button!.props.onClick();
    await settle();
    expect(ledger.downloads).toHaveLength(1);
    return ledger.downloads[0]!.text.trim().split(/\r?\n/);
  }

  it("a margin purchase exports VAT rate 0, VAT amount 0, net = price; a standard one keeps its VAT", async () => {
    await openLedger(
      [phantom(), phantom({ id: "p2", vehicleId: "v2", purchasePrice: 3000, vatAmount: 500, netAmount: 2500 })],
      [marginCar, standardCar]
    );
    const lines = await exportPurchases();
    expect(lines[0]).toBe("Vehicle ID,Purchase Price,Source,Date,VAT Rate,VAT Amount,Net Amount");
    expect(lines[1]).toBe("v1,6000,Auction,2026-03-01,0,0,6000"); // margin: none
    expect(lines[2]).toBe("v2,3000,Auction,2026-03-01,0.2,500,2500"); // standard: real
  });
});

describe("nothing stored is rewritten by showing it", () => {
  it("the stored ledger keeps its phantom VAT, and reading it saves nothing", async () => {
    await openLedger([phantom()], [marginCar]);
    show(BookkeepingEntryScreen as (p: any) => unknown);
    await settle();
    expect(puts).toEqual([]);
    expect(ctx().purchases[0]).toMatchObject({ vatAmount: 1000, vatRate: 0.2, vatIncluded: true });
    expect(ctx().purchases[0].vatScheme).toBeUndefined();
  });
});

describe("the provider stores no VAT on a purchase that says it is margin", () => {
  const entry = (over: Record<string, unknown> = {}) => ({
    id: "new",
    vehicleId: "v9",
    purchasePrice: 6000,
    source: "Auction",
    date: "2026-03-01",
    vatRate: 0.2,
    vatIncluded: true,
    vatAmount: 999,
    netAmount: 999,
    ...over,
  });

  it("a margin purchase handed in with 20% included is stored with 0 VAT and net = price", async () => {
    await openLedger([], []);
    ctx().addPurchase(entry({ vatScheme: "margin" }));
    await settle();
    expect(puts).toHaveLength(1);
    expect(puts[0].purchases[0]).toMatchObject({ vatScheme: "margin", vatRate: 0, vatIncluded: false, vatAmount: 0, netAmount: 6000 });
  });

  it("a standard purchase keeps the VAT worked out from its own rate: 6,000 incl 20% is 1,000 VAT", async () => {
    await openLedger([], []);
    ctx().addPurchase(entry({ vatScheme: "standard" }));
    await settle();
    expect(puts[0].purchases[0]).toMatchObject({ vatScheme: "standard", vatRate: 0.2, vatIncluded: true, netAmount: 5000 });
    expect(puts[0].purchases[0].vatAmount).toBeCloseTo(1000, 10);
  });

  it("a purchase with no scheme at all (the CSV import) keeps the rate it was given", async () => {
    await openLedger([], []);
    ctx().addPurchase(entry({ vatRate: 0, vatIncluded: false }));
    await settle();
    expect(puts[0].purchases[0]).toMatchObject({ vatRate: 0, vatIncluded: false, vatAmount: 0, netAmount: 6000 });
  });
});
