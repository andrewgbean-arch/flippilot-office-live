import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL Import screen and the REAL bookkeeping provider (through the stand-in
// for React's hooks in lib/testing/hookRuntime.ts) against a fake server that holds
// the ledger. Only the stock and consumables contexts are stubbed.
//
// The bug: the import added its purchases one at a time in a loop, and every call
// built its new list from the same out-of-date copy of the books, so of N priced
// cars only the LAST purchase was kept, while the screen said "Imported N vehicles".
// (Audit MONEY-1 / RECORD-1: a 5-car CSV gave 5 cars and 1 purchase.)

const ledger = vi.hoisted(() => ({
  doc: { costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [] } as Record<string, any[]>,
  provider: null as any,
  // Whether the fake server accepts a save.
  acceptSaves: true,
  // The cars already in stock (for the re-import test).
  stock: [] as any[],
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
// The Import screen reads the ledger from the LIVE provider mounted below.
vi.mock("@/bookkeeping/BookkeepingProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/bookkeeping/BookkeepingProvider")>();
  return { ...actual, useBookkeeping: () => ledger.provider.result.props.value };
});
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({
    // What the real inventory does: every row becomes a car with its own id and prices.
    importVehicles: (rows: any[]) => rows.map((r, i) => ({ id: `car-${r.model}-${i}`, buyPrice: r.buyPrice ?? null })),
    vehicles: ledger.stock,
  }),
}));
vi.mock("@/context/ConsumablesContext", () => ({ useConsumables: () => ({ importConsumables: async () => {} }) }));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { BookkeepingProvider } from "@/bookkeeping/BookkeepingProvider";
import { byId, buttonByText, screenText } from "@/lib/testing/elementTree";
import ImportScreen from "./ImportScreen";

const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise<void>((resolve) => setTimeout(resolve, 0));
};
const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

let books: Mounted<{ children?: unknown }, any> | null = null;
let screen: Mounted<any, any> | null = null;
let puts: any[];

beforeEach(() => {
  puts = [];
  ledger.acceptSaves = true;
  vi.stubGlobal("fetch", async (_url: unknown, init?: { method?: string; body?: string }) => {
    if ((init?.method ?? "GET").toUpperCase() === "PUT") {
      const body = JSON.parse(init!.body!);
      puts.push(body);
      if (ledger.acceptSaves) ledger.doc = body;
      return reply(200, { ok: true, ...body });
    }
    return reply(200, { ok: true, ...ledger.doc });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  screen?.unmount();
  books?.unmount();
  screen = null;
  books = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openBooks(doc: Partial<Record<string, any[]>> = {}) {
  ledger.doc = { costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [], ...doc };
  books = mount(BookkeepingProvider as (p: { children?: unknown }) => unknown, { children: null }) as Mounted<
    { children?: unknown },
    any
  >;
  ledger.provider = books;
  await settle();
}

async function importCsv(csv: string, buttonLabel: string) {
  screen = mount(ImportScreen as (p: object) => unknown, {}) as Mounted<any, any>;
  byId(screen.result, "importscreen-csv-file")!.props.onChange({
    target: { files: [{ name: "stock.csv", text: async () => csv }] },
  });
  await settle();
  buttonByText(screen.result, buttonLabel)!.props.onClick();
  await settle();
}

// The audit's own file: five cars, each with a buy price.
const FIVE = [
  "Make,Model,Buy Price,Sell Price",
  "Ford,Focus,5000,6500",
  "Audi,A3,4500,6000",
  "VW,Golf,3000,4200",
  "BMW,X1,7000,9000",
  "Fiat,500,1500,2500",
].join("\n");

describe("importing a file with cars already in stock", () => {
  afterEach(() => {
    ledger.stock = [];
  });

  it("leaves out a car whose registration is already in stock, however it's spaced, and says so", async () => {
    ledger.stock = [{ id: "old", reg: "AB18 CDE", make: "Ford", model: "Focus" }];
    await openBooks();
    const csv = ["Make,Model,Reg,Buy Price", "Ford,Focus,AB18CDE,5000", "Audi,A3,KX19 AUD,4500", "Audi,A3,kx19aud,4500"].join(String.fromCharCode(10));
    await importCsv(csv, "Import 3 Vehicles");
    // one new car (the A3 once), no purchase for the Focus already there
    expect(ledger.doc.purchases!.map((p) => p.purchasePrice)).toEqual([4500]);
    expect(screenText(screen!.result)).toContain("Imported 1 vehicle.");
    expect(screenText(screen!.result)).toContain("Left out 2 cars already in your stock");
  });
});

describe("importing priced cars into the real books", () => {
  it("keeps ALL five purchases, on the screen and on the server (it used to keep one)", async () => {
    await openBooks();
    await importCsv(FIVE, "Import 5 Vehicles");

    const stored = ledger.doc.purchases!.map((p) => p.purchasePrice).sort((a, b) => a - b);
    expect(stored).toEqual([1500, 3000, 4500, 5000, 7000]);
    expect(books!.result.props.value.purchases).toHaveLength(5);
    expect(screenText(screen!.result)).toContain("Imported 5 vehicles.");
  });

  it("saves them in a single request", async () => {
    await openBooks();
    await importCsv(FIVE, "Import 5 Vehicles");
    expect(puts).toHaveLength(1);
    expect(puts[0].purchases).toHaveLength(5);
  });

  it("each purchase belongs to its own car and carries its own price", async () => {
    await openBooks();
    await importCsv(FIVE, "Import 5 Vehicles");
    const byCar = Object.fromEntries(ledger.doc.purchases!.map((p) => [p.vehicleId, p.purchasePrice]));
    expect(byCar).toEqual({
      "car-Focus-0": 5000,
      "car-A3-1": 4500,
      "car-Golf-2": 3000,
      "car-X1-3": 7000,
      "car-500-4": 1500,
    });
    for (const p of ledger.doc.purchases!) {
      expect(p).toMatchObject({ source: "CSV Import", vatRate: 0, vatIncluded: false, vatAmount: 0 });
      expect(p.netAmount).toBe(p.purchasePrice);
    }
  });

  it("adds to the purchases already in the books instead of replacing them", async () => {
    const existing = ["a", "b", "c"].map((id, i) => ({
      id: `old-${id}`,
      vehicleId: `old-car-${id}`,
      purchasePrice: 2000 + i * 1000,
      source: "Auction",
      date: "2026-01-01",
      vatRate: 0,
      vatIncluded: false,
      vatAmount: 0,
      netAmount: 2000 + i * 1000,
    }));
    await openBooks({ purchases: existing });
    await importCsv(FIVE, "Import 5 Vehicles");
    expect(ledger.doc.purchases).toHaveLength(8);
    expect(ledger.doc.purchases!.slice(0, 3).map((p) => p.id)).toEqual(["old-a", "old-b", "old-c"]);
  });

  it("the hub's 'Total spent' counts every car bought", async () => {
    await openBooks();
    await importCsv(FIVE, "Import 5 Vehicles");
    expect(books!.result.props.value.getTotalSpend()).toBe(5000 + 4500 + 3000 + 7000 + 1500);
  });

  it("cars with no buy price get no purchase, and the rest still all do", async () => {
    await openBooks();
    await importCsv(
      ["Make,Model,Buy Price", "Ford,Focus,5000", "Audi,A3,", "VW,Golf,3000", "BMW,X1,abc"].join("\n"),
      "Import 4 Vehicles"
    );
    expect(ledger.doc.purchases!.map((p) => p.purchasePrice)).toEqual([5000, 3000]);
  });

  it("tells the dealer when the books refused the purchases (the books had not loaded)", async () => {
    // A load that fails leaves the books unwritable: nothing may be saved over them.
    vi.stubGlobal("fetch", async () => reply(500, { ok: false }));
    ledger.doc = { costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [] };
    books = mount(BookkeepingProvider as (p: { children?: unknown }) => unknown, { children: null }) as Mounted<
      { children?: unknown },
      any
    >;
    ledger.provider = books;
    await settle();

    await importCsv(FIVE, "Import 5 Vehicles");
    const t = screenText(screen!.result);
    expect(t).toContain("Imported 5 vehicles.");
    expect(t).toContain("5 of the imported cars had a buy price, but their purchase records could not be saved to your books");
    expect(books!.result.props.value.purchases).toHaveLength(0);
  });
});
