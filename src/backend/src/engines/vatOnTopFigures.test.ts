import { describe, it, expect } from "vitest";
import { recordedSalePrice, saleRevenue } from "./recordedPrice";
import { forecastRevenue } from "./superBrainEngine";
import { extractFacts } from "./simulator";
import { countEvidence } from "./decisionAnalysis";
import { computeCurrentMetricValue } from "../routes/cofounder";

// A Standard VAT sale saved with "price includes VAT: no" stores the price BEFORE
// VAT (salePrice 5,000, vatAmount 1,000: the customer paid 6,000). Pilot Brain's
// engines read salePrice as it stood, so such a sale counted £1,000 less revenue
// and profit than the same sale saved with the VAT included. They now work from
// what the customer paid (recordedPrice.ts), like the Bookkeeping screens.

const NOW = Date.parse("2030-03-15T12:00:00Z");
const DAY = 86400000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString().slice(0, 10);

const onTop = (id: string, vehicleId: string, ago: number, vatAmount: number | null = 1000) => ({
  id, vehicleId, date: daysAgo(ago), salePrice: 5000, vatScheme: "standard", vatRate: 0.2, vatIncluded: false, vatAmount, netAmount: 5000,
});
const included = (id: string, vehicleId: string, ago: number) => ({
  id, vehicleId, date: daysAgo(ago), salePrice: 6000, vatScheme: "standard", vatRate: 0.2, vatIncluded: true, vatAmount: 1000, netAmount: 5000,
});
const purchase = (vehicleId: string) => ({ id: `p-${vehicleId}`, vehicleId, purchasePrice: 4000, date: daysAgo(80) });

describe("reading a sale's price", () => {
  it("VAT on top: the price plus its VAT; unknown VAT: unknown", () => {
    expect(recordedSalePrice(onTop("s", "a", 1))).toBe(6000);
    expect(recordedSalePrice(onTop("s", "a", 1, null))).toBeNull();
    expect(recordedSalePrice(included("s", "a", 1))).toBe(6000);
    expect(recordedSalePrice({ salePrice: 0 })).toBeNull();
  });
  it("revenue counts the paid amount, else the price before VAT, never NaN or a negative", () => {
    expect(saleRevenue(onTop("s", "a", 1))).toBe(6000);
    expect(saleRevenue(onTop("s", "a", 1, null))).toBe(5000);
    expect(saleRevenue({ salePrice: NaN })).toBe(0);
    expect(saleRevenue({ salePrice: -50 })).toBe(0);
  });
});

describe("Pilot Brain's figures treat the two ways of saving one sale the same", () => {
  it("the revenue forecast", () => {
    const sales = (make: typeof onTop | typeof included) => [70, 50, 30, 10].map((ago, i) => make(`s${i}`, `v${i}`, ago));
    const a = forecastRevenue(sales(onTop) as any, NOW);
    const b = forecastRevenue(sales(included) as any, NOW);
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
  });

  it("the simulator's average sale price and profit", () => {
    const facts = (sale: ReturnType<typeof onTop>) =>
      extractFacts({ vehicles: [], leads: [], bookkeeping: { purchases: [purchase("a")], sales: [sale], costs: [] }, now: NOW });
    const a = facts(onTop("s", "a", 10));
    const b = facts(included("s", "a", 10) as ReturnType<typeof onTop>);
    expect(a.avgSalePrice.value).toBe(6000);
    expect(a.avgProfit.value).toBe(2000);
    expect(a.avgSalePrice.value).toBe(b.avgSalePrice.value);
    expect(a.avgProfit.value).toBe(b.avgProfit.value);
  });

  it("the evidence count: a VAT-on-top sale whose VAT isn't recorded has no known profit", () => {
    const book = (sale: ReturnType<typeof onTop>) => ({ purchases: [purchase("a")], sales: [sale], costs: [] });
    expect(countEvidence(book(onTop("s", "a", 10)), [], NOW).knownProfitCars).toBe(1);
    expect(countEvidence(book(onTop("s", "a", 10, null)), [], NOW).knownProfitCars).toBe(0);
  });

  it("goals: revenue and profit this month", () => {
    const books = (sale: any) => ({ purchases: [purchase("a")], sales: [sale], costs: [], transactions: [], suppliers: [], categories: [] } as any);
    for (const sale of [onTop("s", "a", 5), included("s", "a", 5)]) {
      expect(computeCurrentMetricValue("revenue", "monthly", [], [], books(sale), NOW)).toBe(6000);
      expect(computeCurrentMetricValue("profit", "monthly", [], [], books(sale), NOW)).toBe(2000);
    }
  });
});
