import { describe, it, expect } from "vitest";
import { hubTotals } from "./profitTotals";
import { summariseVehicleMargins, formatMoney } from "../backend/src/engines/vehicleMargins";
import { countEvidence } from "../backend/src/engines/decisionAnalysis";
import type { CostEntry, PurchaseEntry, SaleEntry } from "./types";
import { withSaleVat, salePaidAmount } from "./saleVat";
import { recordedSalePrice, saleRevenue } from "../backend/src/engines/recordedPrice";
import { profitForVehicle } from "../backend/src/engines/advisorEngine";

// ONE ledger, fed to the Bookkeeping hub (the web app's hubTotals) and to Pilot Brain's
// per-car profit and evidence counts (the backend engines). Pilot Brain's own text says
// its profit is "worked out exactly as the Bookkeeping screen does it" and that it must
// never contradict the screen. It did, for any purchase or sale price that is not a real
// amount above zero: for a purchase saved as 0 the hub said "profit unknown, sale left
// out" while Pilot Brain said "bought £0, sold £5,000, profit £5,000 (100.0%)".

const NOW = Date.parse("2030-03-15T12:00:00Z");
const DAY = 86400000;
const dateDaysAgo = (n: number) => new Date(NOW - n * DAY).toISOString().slice(0, 10);

// Every kind of stored value a price can hold: real ones, and the ones that are not prices.
const PRICES: [string, unknown][] = [
  ["a real price", 4500],
  ["0", 0],
  ["null (NaN once saved)", null],
  ["missing", undefined],
  ["text", "4500"],
  ["negative", -100],
];

function ledger(bought: unknown, sold: unknown, cost: number | null) {
  const purchase: Record<string, unknown> = { id: "p", vehicleId: "a", date: dateDaysAgo(60) };
  if (bought !== undefined) purchase.purchasePrice = bought;
  const sale: Record<string, unknown> = { id: "s", vehicleId: "a", date: dateDaysAgo(10) };
  if (sold !== undefined) sale.salePrice = sold;
  return {
    purchases: [purchase],
    sales: [sale],
    costs: cost === null ? [] : [{ id: "c", vehicleId: "a", amount: cost, date: dateDaysAgo(30) }],
  };
}

const hubOf = (book: ReturnType<typeof ledger>) =>
  hubTotals(book.purchases as unknown as PurchaseEntry[], book.sales as unknown as SaleEntry[], book.costs as unknown as CostEntry[]);

function brainKnown(book: ReturnType<typeof ledger>): number {
  const lines = summariseVehicleMargins(book, [], NOW);
  const match = /: (\d+) sold, profit known for (\d+)/.exec(lines[0] ?? "");
  if (!match) throw new Error(`unexpected heading: ${lines[0]}`);
  return Number(match[2]);
}

describe("the hub and Pilot Brain agree about which cars have a profit", () => {
  const cases = PRICES.flatMap(([bName, bought]) =>
    PRICES.flatMap(([sName, sold]) => [null, 300].map((cost) => [`purchase ${bName}, sale ${sName}, cost ${cost ?? "none"}`, bought, sold, cost] as const))
  );

  it.each(cases)("%s", (_name, bought, sold, cost) => {
    const book = ledger(bought, sold, cost);
    const hub = hubOf(book);
    // Same number of cars worked out
    expect(brainKnown(book)).toBe(hub.soldCounted);
    // The evidence behind Pilot's view counts the same cars
    expect(countEvidence(book, [], NOW).knownProfitCars).toBe(hub.soldCounted);
    // And when there is a profit, it is the same profit
    if (hub.soldCounted === 1) {
      const lines = summariseVehicleMargins(book, [], NOW);
      expect(lines[1]).toContain(`Total ${formatMoney(hub.profit)} on ${formatMoney(hub.revenue)} of sales`);
    }
  });

  it("the audit's exact ledger: one purchase saved as 0 and one 5,000 sale", () => {
    const book = ledger(0, 5000, null);
    const hub = hubOf(book);
    expect(hub).toMatchObject({ profit: 0, soldCounted: 0, soldWithoutPurchase: 1 });
    const text = summariseVehicleMargins(book, [{ id: "a", make: "Ford", model: "Focus", year: 2015 }], NOW).join("\n");
    expect(text).not.toContain("bought £0");
    expect(text).not.toContain("profit £5,000");
    expect(brainKnown(book)).toBe(0);
  });

  it("a real car is worked out identically by both", () => {
    const book = ledger(4500, 5000, 120);
    const hub = hubOf(book);
    expect(hub.profit).toBe(380);
    expect(brainKnown(book)).toBe(1);
    expect(summariseVehicleMargins(book, [], NOW).join("\n")).toContain("Total £380 on £5,000 of sales");
  });
});

/* ------------- VAT added ON TOP of the price: the same sale either way ------------- */
// A Standard VAT sale saved with "price includes VAT: no" stores the price BEFORE VAT.
// Read as it stood, it showed £1,000 less profit and revenue than the identical sale
// saved with the VAT included. Both the hub and Pilot Brain now work from what the
// customer paid, so the two ways of saving one sale agree, everywhere.

describe("VAT added on top: the same profit and revenue as the same sale with VAT included", () => {
  const purchase = { id: "p", vehicleId: "a", purchasePrice: 4000, date: dateDaysAgo(60) };
  const onTop = withSaleVat({ id: "s", vehicleId: "a", salePrice: 5000, invoiceNumber: "INV-1", date: dateDaysAgo(10), vatScheme: "standard", vatRate: 0.2, vatIncluded: false, vatAmount: null, netAmount: null } as SaleEntry, undefined);
  const included = withSaleVat({ ...onTop, salePrice: 6000, vatIncluded: true } as SaleEntry, undefined);
  const book = (sale: SaleEntry) => ({ purchases: [purchase], sales: [sale], costs: [] as unknown[] });

  it("the web hub: £2,000 profit on £6,000 either way", () => {
    for (const sale of [onTop, included]) {
      const hub = hubTotals([purchase as PurchaseEntry], [sale], []);
      expect(hub).toMatchObject({ profit: 2000, revenue: 6000, soldCounted: 1 });
    }
  });

  it("Pilot Brain's per-car margins say the same as the hub", () => {
    for (const sale of [onTop, included]) {
      const lines = summariseVehicleMargins(book(sale), [], NOW);
      expect(lines[1]).toContain(`Total ${formatMoney(2000)} on ${formatMoney(6000)} of sales`);
    }
  });

  it("the advisor's per-car profit and the revenue totals agree too", () => {
    for (const sale of [onTop, included]) {
      expect(profitForVehicle("a", book(sale) as any)).toBe(2000);
      expect(saleRevenue(sale)).toBe(6000);
    }
  });

  it("web and backend read the paid amount the same way, and unknown VAT stays unknown", () => {
    expect(salePaidAmount(onTop)).toBe(6000);
    expect(recordedSalePrice(onTop)).toBe(6000);
    const vatUnknown = { ...onTop, vatAmount: null } as SaleEntry;
    expect(salePaidAmount(vatUnknown)).toBeNull();
    expect(recordedSalePrice(vatUnknown)).toBeNull();
    // Revenue still counts at least the price before VAT.
    expect(saleRevenue(vatUnknown)).toBe(5000);
  });

  it("a Margin Scheme sale is untouched", () => {
    const margin = { ...onTop, vatScheme: "margin", salePrice: 6000 } as SaleEntry;
    expect(recordedSalePrice(margin)).toBe(6000);
    expect(salePaidAmount(margin)).toBe(6000);
  });
});
