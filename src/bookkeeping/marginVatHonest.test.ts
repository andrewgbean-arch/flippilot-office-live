import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Margin Scheme VAT is worked out from what the car COST. A purchase saved with no
// usable price (0, nothing, text, a negative) is not a price, but the Record Sale form
// and the provider still used it as a real cost of £0: a £6,000 sale of such a car
// stored £1,000 of VAT (a sixth of the WHOLE price; the real figure on a £5,000 car
// is £166.67), showed it as "VAT Due £1,000.00" in the form, and printed it in the
// ledger next to a profit of "—". It was a VAT figure invented for the dealer's VAT
// return.
//
// These tests run the REAL Record Sale form, the REAL provider (through the stand-in
// for React's hooks in lib/testing/hookRuntime.ts, against a fake server holding the
// ledger) and the REAL ledger table and car page.

const state = vi.hoisted(() => ({
  doc: { costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [] } as Record<string, any[]>,
  provider: null as any,
  car: { id: "v1", make: "Ford", model: "Focus", vatScheme: "margin" } as any,
  markedSold: [] as { id: string; price: number }[],
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
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { dealershipId: "dealer-a" } }) }));
// The screens read the ledger from the LIVE provider mounted below.
vi.mock("@/bookkeeping/BookkeepingProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/bookkeeping/BookkeepingProvider")>();
  return { ...actual, useBookkeeping: () => state.provider.result.props.value };
});
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({
    vehicles: [state.car],
    updateVehicleSale: (id: string, price: number) => void state.markedSold.push({ id, price }),
  }),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => () => {},
  useParams: () => ({ vehicleId: "v1" }),
}));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { BookkeepingProvider } from "@/bookkeeping/BookkeepingProvider";
import BookkeepingTable from "@/bookkeeping/BookkeepingTable";
import BookkeepingEntryScreen from "@/bookkeeping/BookkeepingEntryScreen";
import RecordPurchasePriceModal from "@/bookkeeping/RecordPurchasePriceModal";
import AddSaleModal from "@/bookkeeping/AddSaleModal";
import { byId, buttonByText, typeInto, alerts, screenText, findAll, textOf } from "@/lib/testing/elementTree";
import { marginVatForSale } from "./vatUtils";
import { withSaleVat, trustedSaleVat } from "./saleVat";
import { hubTotals } from "./profitTotals";
import type { SaleEntry } from "./types";

const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise<void>((resolve) => setTimeout(resolve, 0));
};
const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

let books: Mounted<{ children?: unknown }, any> | null = null;
let screen: Mounted<any, any> | null = null;
let puts: any[];
let closed: number;
let refuseSaves: boolean;

beforeEach(() => {
  puts = [];
  closed = 0;
  refuseSaves = false;
  state.markedSold = [];
  state.car = { id: "v1", make: "Ford", model: "Focus", vatScheme: "margin" };
  vi.stubGlobal("fetch", async (_url: unknown, init?: { method?: string; body?: string }) => {
    if ((init?.method ?? "GET").toUpperCase() === "PUT") {
      const body = JSON.parse(init!.body!);
      puts.push(body);
      if (!refuseSaves) state.doc = body;
      return reply(200, { ok: true, ...body });
    }
    return reply(200, { ok: true, ...state.doc });
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

async function openBooks(doc: Partial<Record<string, any[]>>) {
  state.doc = { costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [], ...doc };
  books = mount(BookkeepingProvider as (p: { children?: unknown }) => unknown, { children: null }) as Mounted<{ children?: unknown }, any>;
  state.provider = books;
  await settle();
}
const ctx = () => books!.result.props.value as any;

// A stored purchase whose price can be anything, including what an old blank left behind.
const purchase = (purchasePrice: unknown, extra: Record<string, unknown> = {}) => {
  const p: Record<string, unknown> = {
    id: "p1",
    vehicleId: "v1",
    source: "Auction",
    date: "2026-03-01",
    vatScheme: "margin",
    vatRate: 0,
    vatIncluded: false,
    vatAmount: 0,
    netAmount: 0,
    ...extra,
  };
  if (purchasePrice !== undefined) p.purchasePrice = purchasePrice; // undefined = the field is missing
  return p;
};

// What a purchase can hold that is NOT a price. (JSON turns NaN into null, so null is
// what NaN looks like once it has been saved and loaded.)
const NOT_A_PRICE: [string, unknown][] = [
  ["0", 0],
  ["null (NaN once saved)", null],
  ["missing", undefined],
  ["text", "4500"],
  ["negative", -100],
];

async function openSaleForm(props: Record<string, unknown> = {}) {
  screen = mount(AddSaleModal as (p: any) => unknown, { vehicleId: "v1", onClose: () => void closed++, ...props }) as Mounted<any, any>;
  await settle();
}
async function typeSale(id: string, value: string) {
  typeInto(byId(screen!.result, id), value);
  await settle();
}
async function saveSale(label = "Save Sale") {
  buttonByText(screen!.result, label)!.props.onClick();
  await settle();
}
const previewText = () => screenText(screen!.result);

function ledgerRow(): string {
  const table = mount(BookkeepingTable as (p: object) => unknown, {}) as Mounted<any, any>;
  const cells: string[] = [];
  (function collect(node: any) {
    if (Array.isArray(node)) return node.forEach(collect);
    if (!node || typeof node !== "object" || !("props" in node)) return;
    if (node.type === "td") cells.push(screenText(node));
    else collect(node.props.children);
  })(table.result);
  table.unmount();
  return cells.join(" | ");
}

/* ------------------------------ the pure figure ------------------------------ */

describe("marginVatForSale: the margin VAT of a recorded sale, or nothing", () => {
  it("works out a sixth of the margin at 20%: a 6,000 sale of a 5,000 car", () => {
    const m = marginVatForSale(6000, 5000, 0.2)!;
    expect(m.margin).toBe(1000);
    expect(m.vat).toBeCloseTo(166.6667, 3);
  });

  it.each(NOT_A_PRICE)("a purchase price of %s is not a price: NO figure (it was 1,000 on a 6,000 sale)", (_name, price) => {
    expect(marginVatForSale(6000, price, 0.2)).toBeNull();
  });

  it("no figure from a sale price that is not a number, or a rate that is not a rate", () => {
    for (const sale of [NaN, Infinity, null, undefined, "6000"]) expect(marginVatForSale(sale, 5000, 0.2), String(sale)).toBeNull();
    for (const rate of [NaN, -0.2, 2, 20, null, undefined, "0.2"]) expect(marginVatForSale(6000, 5000, rate), String(rate)).toBeNull();
  });

  it("a genuine loss is a real nil VAT, not 'unknown'", () => {
    const m = marginVatForSale(4000, 5000, 0.2)!;
    expect(m.margin).toBe(0);
    expect(m.vat).toBe(0);
  });

  it("a 0% rate is a real rate: VAT nil on a real margin", () => {
    expect(marginVatForSale(6000, 5000, 0)!.vat).toBe(0);
  });
});

/* -------------------------- the shared sale VAT function -------------------------- */

const baseSale = (over: Partial<SaleEntry> = {}): SaleEntry => ({
  id: "s1",
  vehicleId: "v1",
  salePrice: 6000,
  invoiceNumber: "INV-0001",
  date: "2026-03-10",
  vatScheme: "margin",
  vatRate: 0.2,
  vatIncluded: false,
  vatAmount: null,
  netAmount: null,
  ...over,
});

describe("withSaleVat: a sale's VAT, or 'not worked out'", () => {
  it("margin sale, real purchase: margin VAT, net, and the purchase price it came from", () => {
    const s = withSaleVat(baseSale(), { purchasePrice: 5000 });
    expect(s.vatScheme).toBe("margin");
    expect(s.vatAmount).toBeCloseTo(166.6667, 3);
    expect(s.netAmount).toBeCloseTo(6000 - 166.6667, 3);
    expect(s.marginPurchasePrice).toBe(5000);
  });

  it.each(NOT_A_PRICE)("margin sale, purchase price %s: stays a MARGIN sale with VAT null, never a figure and never standard VAT", (_name, price) => {
    const s = withSaleVat(baseSale(), { purchasePrice: price as number });
    expect(s.vatScheme).toBe("margin");
    expect(s.vatAmount).toBeNull();
    expect(s.netAmount).toBeNull();
    expect(s).not.toHaveProperty("marginPurchasePrice");
  });

  it("margin sale with no purchase at all: the same", () => {
    const s = withSaleVat(baseSale(), undefined);
    expect(s).toMatchObject({ vatScheme: "margin", vatAmount: null, netAmount: null });
  });

  it("a stale marginPurchasePrice from an earlier save is dropped, not carried along", () => {
    const s = withSaleVat(baseSale({ marginPurchasePrice: 0, vatAmount: 1000, netAmount: 5000 }), { purchasePrice: 0 });
    expect(s.vatAmount).toBeNull();
    expect(s).not.toHaveProperty("marginPurchasePrice");
  });

  it("standard sale: VAT on the price, whatever the purchase says", () => {
    const s = withSaleVat(baseSale({ vatScheme: "standard", vatIncluded: true }), undefined);
    expect(s.vatScheme).toBe("standard");
    expect(s.vatAmount).toBeCloseTo(1000, 10);
    expect(s.netAmount).toBeCloseTo(5000, 10);
  });

  it("standard sale, VAT on top", () => {
    const s = withSaleVat(baseSale({ vatScheme: "standard", vatIncluded: false, salePrice: 1000 }), undefined);
    expect(s.vatAmount).toBeCloseTo(200, 10);
    expect(s.netAmount).toBe(1000);
  });

  it.each([NaN, -0.2, 2, null])("standard sale with a VAT rate of %s: VAT null, not NaN or a wild figure", (rate) => {
    const s = withSaleVat(baseSale({ vatScheme: "standard", vatRate: rate as number }), undefined);
    expect(s.vatAmount).toBeNull();
    expect(s.netAmount).toBeNull();
  });
});

describe("trustedSaleVat: a stored VAT figure is only shown if it can be trusted", () => {
  it("a good stored margin sale shows its figures", () => {
    const stored = withSaleVat(baseSale(), { purchasePrice: 5000 });
    expect(trustedSaleVat(stored).vat).toBeCloseTo(166.6667, 3);
  });

  it.each(NOT_A_PRICE)("a margin sale saved with a purchase price of %s carries an invented VAT figure: not shown", (_name, price) => {
    // exactly what the old code stored: VAT worked from a cost of £0
    const legacy = baseSale({ vatAmount: 1000, netAmount: 5000, ...(price === undefined ? {} : { marginPurchasePrice: price as number }) });
    expect(trustedSaleVat(legacy)).toEqual({ vat: null, net: null });
  });

  it("a sale with no usable price shows no VAT", () => {
    expect(trustedSaleVat(baseSale({ salePrice: 0, vatScheme: "standard", vatAmount: 0, netAmount: 0 }))).toEqual({ vat: null, net: null });
  });

  it("a standard sale's stored figures are shown as stored", () => {
    expect(trustedSaleVat(baseSale({ vatScheme: "standard", vatAmount: 200, netAmount: 1000 }))).toEqual({ vat: 200, net: 1000 });
  });
});

/* ---------------------------- the real Record Sale form ---------------------------- */

describe("the Record Sale form never works margin VAT from a purchase that is not a price", () => {
  it("baseline: a real 5,000 purchase and a 6,000 sale is 166.67 of VAT", async () => {
    await openBooks({ purchases: [purchase(5000)] });
    await openSaleForm();
    await typeSale("addsalemodal-sale-price", "6000");
    expect(previewText()).toContain("Purchase Price £5,000.00 Margin £1,000.00 VAT Due (Margin Scheme) £166.67");
    await saveSale();
    expect(ctx().sales[0]).toMatchObject({ vatScheme: "margin", marginPurchasePrice: 5000 });
    expect(ctx().sales[0].vatAmount).toBeCloseTo(166.6667, 3);
  });

  it.each(NOT_A_PRICE)("purchase price %s: the preview says Not recorded, not 'Purchase Price £0.00 ... VAT Due £1,000.00'", async (_name, price) => {
    await openBooks({ purchases: [purchase(price)] });
    await openSaleForm();
    await typeSale("addsalemodal-sale-price", "6000");
    const t = previewText();
    expect(t).toContain("Purchase Price Not recorded Margin — VAT Due (Margin Scheme) —");
    expect(t).not.toContain("£1,000.00");
    expect(t).not.toContain("£6,000.00"); // not a margin of the whole price either
    expect(t).not.toContain("£0.00");
    // and the notice explains, in place of "standard VAT until it does"
    expect(t).toContain("has no purchase price on record, so the VAT due can't be worked out yet");
    expect(t).not.toContain("standard VAT until it does");
  });

  it.each(NOT_A_PRICE)("purchase price %s: the sale is saved as a MARGIN sale with NO VAT figure (it stored 1,000 before)", async (_name, price) => {
    await openBooks({ purchases: [purchase(price)] });
    await openSaleForm();
    await typeSale("addsalemodal-sale-price", "6000");
    await saveSale();

    const stored = state.doc.sales![0];
    expect(stored).toMatchObject({ vatScheme: "margin", salePrice: 6000, vatAmount: null, netAmount: null });
    expect(stored).not.toHaveProperty("marginPurchasePrice");
    expect(JSON.stringify(stored)).not.toMatch(/1000|833/);
    expect(closed).toBe(1);
    expect(state.markedSold).toEqual([{ id: "v1", price: 6000 }]); // the sale itself is not blocked
  });

  it.each(NOT_A_PRICE)("purchase price %s: the ledger row shows no VAT (a dash), next to the dash for profit", async (_name, price) => {
    await openBooks({ purchases: [purchase(price)] });
    await openSaleForm();
    await typeSale("addsalemodal-sale-price", "6000");
    await saveSale();
    await settle();
    // Vehicle | Purchase | Total Cost | Sale | Profit | Margin | VAT Due | From | Date
    expect(ledgerRow()).toContain("Ford Focus | — | £0 | £6,000 | — | — | — |");
    expect(ledgerRow()).not.toMatch(/1,000|833/);
    expect(hubTotals(ctx().purchases, ctx().sales, ctx().costs).profit).toBe(0);
  });

  it("a car with no purchase at all is the same: a margin sale, no VAT figure, not switched to standard", async () => {
    await openBooks({});
    await openSaleForm();
    await typeSale("addsalemodal-sale-price", "6000");
    await saveSale();
    expect(state.doc.sales![0]).toMatchObject({ vatScheme: "margin", vatAmount: null, netAmount: null });
  });

  it("editing a sale that was stored with the invented figure replaces it with 'not worked out'", async () => {
    const legacy = baseSale({ vatAmount: 1000, netAmount: 5000, marginPurchasePrice: 0 });
    await openBooks({ purchases: [purchase(0)], sales: [legacy] });
    await openSaleForm({ existing: legacy });
    await saveSale("Update Sale");
    expect(state.doc.sales![0]).toMatchObject({ vatScheme: "margin", vatAmount: null, netAmount: null });
    expect(state.doc.sales![0]).not.toHaveProperty("marginPurchasePrice");
  });

  it("a STANDARD-scheme car is unaffected: it needs no purchase price for its VAT", async () => {
    state.car = { id: "v1", make: "Ford", model: "Focus", vatScheme: "standard" };
    await openBooks({ purchases: [purchase(0)] });
    await openSaleForm();
    await typeSale("addsalemodal-sale-price", "1200");
    await saveSale();
    const stored = state.doc.sales![0];
    expect(stored.vatScheme).toBe("standard");
    expect(stored.vatAmount).toBeCloseTo(200, 10);
    expect(stored.netAmount).toBeCloseTo(1000, 10);
  });
});

describe("the provider is the last line: addSale and updateSale never store a made-up margin VAT", () => {
  it.each(NOT_A_PRICE)("addSale for a margin sale with a purchase price of %s stores VAT null", async (_name, price) => {
    await openBooks({ purchases: [purchase(price)] });
    ctx().addSale(baseSale({ vatAmount: 1000, netAmount: 5000 })); // even if the caller hands it a figure
    await settle();
    expect(state.doc.sales![0]).toMatchObject({ vatScheme: "margin", vatAmount: null, netAmount: null });
  });

  it.each(NOT_A_PRICE)("updateSale on a margin sale with a purchase price of %s stores VAT null", async (_name, price) => {
    await openBooks({ purchases: [purchase(price)], sales: [baseSale({ vatAmount: 1000, netAmount: 5000, marginPurchasePrice: 0 })] });
    ctx().updateSale("s1", { salePrice: 6500 });
    await settle();
    expect(state.doc.sales![0]).toMatchObject({ salePrice: 6500, vatScheme: "margin", vatAmount: null, netAmount: null });
  });

  it("and with a real purchase they store the real figure", async () => {
    await openBooks({ purchases: [purchase(5000)] });
    ctx().addSale(baseSale());
    await settle();
    expect(state.doc.sales![0].vatAmount).toBeCloseTo(166.6667, 3);
    ctx().updateSale("s1", { salePrice: 7000 });
    await settle();
    expect(state.doc.sales![0].vatAmount).toBeCloseTo(333.3333, 3);
  });
});

/* -------------------- recording the purchase price afterwards -------------------- */

describe("recordPurchasePrice: giving a 'Not recorded' purchase its price", () => {
  it("records the price and works out the VAT that was waiting for it, in ONE save", async () => {
    const sale = withSaleVat(baseSale(), { purchasePrice: 0 }); // as it is stored now: VAT null
    await openBooks({ purchases: [purchase(0)], sales: [sale] });
    puts = [];

    expect(ctx().recordPurchasePrice("v1", 5000, "margin")).toBe(true);
    await settle();

    expect(puts).toHaveLength(1);
    expect(state.doc.purchases![0]).toMatchObject({ purchasePrice: 5000, vatScheme: "margin", vatRate: 0, vatIncluded: false, vatAmount: 0, netAmount: 5000 });
    expect(state.doc.sales![0]).toMatchObject({ vatScheme: "margin", marginPurchasePrice: 5000 });
    expect(state.doc.sales![0].vatAmount).toBeCloseTo(166.6667, 3);
    // and the profit that was unknown now is worked out
    expect(ctx().getProfitForVehicle("v1")!.profit).toBe(1000);
  });

  it("also repairs a margin sale that was stored with the invented VAT", async () => {
    await openBooks({ purchases: [purchase(0)], sales: [baseSale({ vatAmount: 1000, netAmount: 5000, marginPurchasePrice: 0 })] });
    ctx().recordPurchasePrice("v1", 5000, "margin");
    await settle();
    expect(state.doc.sales![0].vatAmount).toBeCloseTo(166.6667, 3);
  });

  it("leaves a STANDARD sale alone: an invoice already issued must not change under the customer", async () => {
    const standard = baseSale({ vatScheme: "standard", vatIncluded: true, vatAmount: 1000, netAmount: 5000 });
    await openBooks({ purchases: [purchase(null)], sales: [standard] });
    ctx().recordPurchasePrice("v1", 5000, "margin");
    await settle();
    expect(state.doc.sales![0]).toEqual(standard);
  });

  it("works for a standard-scheme purchase too: the price is stored with its own VAT worked out", async () => {
    await openBooks({ purchases: [purchase(0, { vatScheme: "standard", vatRate: 0.2, vatIncluded: true })] });
    ctx().recordPurchasePrice("v1", 6000, "standard");
    await settle();
    expect(state.doc.purchases![0]).toMatchObject({ purchasePrice: 6000, vatScheme: "standard", vatRate: 0.2, vatIncluded: true });
    expect(state.doc.purchases![0].vatAmount).toBeCloseTo(1000, 10);
    expect(state.doc.purchases![0].netAmount).toBeCloseTo(5000, 10);
  });

  it("only touches the car it was asked about", async () => {
    const other = purchase(3000, { id: "p2", vehicleId: "v2" });
    await openBooks({ purchases: [purchase(0), other] });
    ctx().recordPurchasePrice("v1", 5000, "margin");
    await settle();
    expect(state.doc.purchases![1]).toEqual(other);
  });

  it.each([
    ["zero", 0],
    ["negative", -5],
    ["NaN", NaN],
    ["Infinity", Infinity],
  ])("a price of %s is refused: nothing is saved", async (_name, price) => {
    await openBooks({ purchases: [purchase(0)] });
    puts = [];
    expect(ctx().recordPurchasePrice("v1", price as number, "margin")).toBe(false);
    await settle();
    expect(puts).toEqual([]);
  });

  it("a car with no purchase on record is refused (there is nothing to fix)", async () => {
    await openBooks({});
    puts = [];
    expect(ctx().recordPurchasePrice("v1", 5000, "margin")).toBe(false);
    expect(puts).toEqual([]);
  });

  it("is refused while the books have not loaded, like every other write", async () => {
    vi.stubGlobal("fetch", async () => reply(500, { ok: false }));
    books = mount(BookkeepingProvider as (p: { children?: unknown }) => unknown, { children: null }) as Mounted<{ children?: unknown }, any>;
    state.provider = books;
    await settle();
    expect(ctx().recordPurchasePrice("v1", 5000, "margin")).toBe(false);
  });
});

describe("the car's page: a purchase that is 'Not recorded' can now be recorded", () => {
  const page = () => {
    screen = mount(BookkeepingEntryScreen as (p: object) => unknown, {}) as Mounted<any, any>;
    return screen;
  };

  it("offers Record purchase price only when the price is not recorded", async () => {
    await openBooks({ purchases: [purchase(0)] });
    expect(buttonByText(page().result, "Record purchase price")).toBeDefined();
    screen!.unmount();

    state.doc.purchases = [purchase(4500)];
    await openBooks({ purchases: [purchase(4500)] });
    expect(buttonByText(page().result, "Record purchase price")).toBeUndefined();
  });

  it("opens the form for this car with the car's own scheme", async () => {
    await openBooks({ purchases: [purchase(0)] });
    const p = page();
    buttonByText(p.result, "Record purchase price")!.props.onClick();
    await settle();
    const modal = findAll(p.result, (el) => el.type === RecordPurchasePriceModal)[0]!;
    expect(modal.props).toMatchObject({ vehicleId: "v1", scheme: "margin" });

    state.car = { id: "v1", make: "Ford", model: "Focus", vatScheme: "standard" };
    const q = page();
    buttonByText(q.result, "Record purchase price")!.props.onClick();
    await settle();
    expect(findAll(q.result, (el) => el.type === RecordPurchasePriceModal)[0]!.props.scheme).toBe("standard");
  });

  it("a margin sale with unknown VAT says so, instead of showing a figure", async () => {
    const sale = withSaleVat(baseSale(), { purchasePrice: 0 });
    await openBooks({ purchases: [purchase(0)], sales: [sale] });
    const t = screenText(page().result);
    expect(t).toContain("Price: Not recorded");
    expect(t).toContain("Sale Price: £6,000");
    expect(t).toContain("VAT: — Net: —");
    expect(t).toContain("The VAT due on this Margin Scheme sale is not worked out: it needs a recorded purchase price.");
    expect(t).not.toMatch(/1,000|833/);
  });

  it("a legacy sale with the invented VAT is shown as not worked out too", async () => {
    await openBooks({ purchases: [purchase(0)], sales: [baseSale({ vatAmount: 1000, netAmount: 5000, marginPurchasePrice: 0 })] });
    const t = screenText(page().result);
    expect(t).toContain("VAT: — Net: —");
    expect(t).not.toMatch(/£1,000\.00|£5,000\.00/);
  });
});

describe("the Record Purchase Price form", () => {
  async function openModal(props: Record<string, unknown> = {}) {
    screen = mount(RecordPurchasePriceModal as (p: any) => unknown, { vehicleId: "v1", scheme: "margin", onClose: () => void closed++, ...props }) as Mounted<any, any>;
    await settle();
  }

  it("saves a real price, records it on the car's purchase, and closes", async () => {
    await openBooks({ purchases: [purchase(0)], sales: [withSaleVat(baseSale(), { purchasePrice: 0 })] });
    await openModal();
    typeInto(byId(screen!.result, "recordpurchaseprice-price"), "£5,000");
    await settle();
    buttonByText(screen!.result, "Save Purchase Price")!.props.onClick();
    await settle();
    expect(closed).toBe(1);
    expect(state.doc.purchases![0].purchasePrice).toBe(5000);
    expect(state.doc.sales![0].vatAmount).toBeCloseTo(166.6667, 3);
  });

  it.each([
    ["", "Enter the purchase price."],
    ["abc", "Enter an amount in pounds"],
    ["0", "greater than £0"],
    ["-4500", "no minus sign"],
    ["4,5", "Commas can only separate thousands"],
  ])("price %j is refused with a message, and nothing is saved", async (text, expected) => {
    await openBooks({ purchases: [purchase(0)] });
    puts = [];
    await openModal();
    typeInto(byId(screen!.result, "recordpurchaseprice-price"), text);
    await settle();
    buttonByText(screen!.result, "Save Purchase Price")!.props.onClick();
    await settle();
    expect(alerts(screen!.result)[0]).toContain(expected);
    expect(closed).toBe(0);
    expect(puts).toEqual([]);
  });

  it("says so, and stays open, when the books would not take it", async () => {
    await openBooks({}); // no purchase for this car
    await openModal();
    typeInto(byId(screen!.result, "recordpurchaseprice-price"), "5000");
    await settle();
    buttonByText(screen!.result, "Save Purchase Price")!.props.onClick();
    await settle();
    expect(closed).toBe(0);
    expect(alerts(screen!.result).join(" ")).toContain("Nothing was saved");
  });

  it("Cancel closes without saving", async () => {
    await openBooks({ purchases: [purchase(0)] });
    puts = [];
    await openModal();
    buttonByText(screen!.result, "Cancel")!.props.onClick();
    expect(closed).toBe(1);
    expect(puts).toEqual([]);
    expect(textOf(screen!.result)).toContain("Record Purchase Price");
  });
});
