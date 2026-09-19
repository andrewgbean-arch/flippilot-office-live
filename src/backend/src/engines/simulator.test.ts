import { describe, it, expect, vi, afterEach } from "vitest";
import {
  extractFacts,
  runSimulation,
  parseSimulationRequest,
  SIMULATION_NOTE,
  MIN_SALES_FOR_CONFIDENCE,
  MIN_KNOWN_PROFITS_FOR_CONFIDENCE,
  SIM_AMOUNT_MIN,
  SIM_AMOUNT_MAX,
  SIM_CUT_MIN,
  SIM_CUT_MAX,
  SIM_DAYS_MIN,
  SIM_DAYS_MAX,
  SIM_EXTRA_SALES_MIN,
  SIM_EXTRA_SALES_MAX,
  type SimulationInputs,
  type SimulationPreview,
  type SimulationRequest,
} from "./simulator";
import { summariseVehicleMargins } from "./vehicleMargins";
import { summariseLeadSources } from "./leadSources";
import { FIGURE_KINDS, parseConfidence, type Figure, type SimScenario } from "../decisionTypes";

// A fixed "now" so nothing here depends on the real date. The seeded dealership
// below is worked out by hand: every expected number in this file can be checked
// with a pencil from the comments, not just copied from the output.
const NOW = Date.parse("2030-06-01T12:00:00Z");

/* ------------------------------------------------------------------ */
/* The seeded dealership                                                */
/* ------------------------------------------------------------------ */
//
// CARS SOLD IN THE LAST 90 DAYS (nine, sold 2030-04-10 to 2030-05-25).
//
//   car  bought (date)          sold (date)            costs        profit  days
//   s1    8,000 (03-20)   10,000 (04-10)      500              1,500    21
//   s2    9,000 (03-15)   11,500 (04-20)      300 + 200        2,000    36
//   s3    6,000 (04-01)    7,500 (04-25)      none             1,500    24
//   s4   10,000 (03-10)   12,500 (05-01)    1,000              1,500    52
//   s5   10,000 (04-05)   12,000 (05-15)      500              1,500    40
//   s6    7,000 (04-10)    8,000 (05-20)      400                600    40
//   s7   (no purchase)     9,000 (05-10)      none             UNKNOWN   -
//   s8    6,000 (04-20)   "n/a" (05-17)       none             UNKNOWN   27
//   s9    8,000 (04-15)   10,500 (05-25)      300 + 300        1,900    40
//
//   Also in the ledger but NOT counted: one sale in 2029 (outside the 90 days),
//   one sale whose date is "not a date" and one dated 2031 (no usable date).
//
//   sold = 9, so 9 / 3 months = 3 cars a month.
//   profit is known for 7 cars: 1,500 + 2,000 + 1,500 + 1,500 + 1,500 + 600 + 1,900
//     = 10,500, and 10,500 / 7 = 1,500 a car. (Counting the two unknown cars as £0
//     would give 10,500 / 9 = 1,166.67: wrong, and the tests below catch it.)
//   average purchase price over the 8 cars that have one: 8+9+6+10+10+7+6+8 = 64
//     thousand, so 64,000 / 8 = 8,000.
//   average sale price over the 8 cars with a real sale price: 10,000 + 11,500 +
//     7,500 + 12,500 + 12,000 + 8,000 + 9,000 + 10,500 = 81,000, so 81,000 / 8 = 10,125.
//   average recorded cost over all 9 (a car with no costs has £0 recorded):
//     500 + 500 + 0 + 1,000 + 500 + 400 + 0 + 0 + 600 = 3,500, so 3,500 / 9 = 388.89.
//     Three cars (s3, s7, s8) have no cost entries at all.
//   average days to sell over the 8 cars with both dates: 21+36+24+52+40+40+27+40
//     = 280, so 280 / 8 = 35 days.
//
// CARS IN STOCK (twelve). Age is counted from the ledger's purchase date if it is
// a real date, otherwise from the car's createdAt (the purchase date is
// deliberately different from createdAt on most of them, to prove which wins):
//
//   car  bought for (purchase date)        age in days on 2030-06-01
//   k1    9,000 (05-20)     12
//   k2    8,000 (05-01)     31
//   k3    7,000 (04-15)     47
//   k4    6,000 (04-02)     60   (exactly 60: counts as "60 days or more")
//   k5   10,000 (04-01)     61
//   k6    5,000 (03-01)     92
//   k7    9,000 (02-01)    120
//   k8    8,000 (01-01)    151
//   k9    3,000 ("soon": not a date) -> createdAt 05-25 09:00         7  (from the date added)
//   k10  no purchase entry, createdAt 03-02                          91  (from the date added)
//   k11  no purchase entry, no createdAt                              unknown
//   k12  price "TBC" (not a number), purchase date 04-20             42  (from the purchase date)
//
//   capital tied up: the nine cars with a real price: 9+8+7+6+10+5+9+8+3 = 65
//     thousand = £65,000. Three cars (k10, k11, k12) have no known price and are
//     left OUT of that total, not counted as £0.
//   ages known for 11 cars: 12+31+47+60+61+92+120+151+7+91+42 = 714, and
//     714 / 11 = 64.909... = 64.91 days on average.
//   60 days or more: k4, k5, k6, k7, k8, k10 = 6 cars.   90 days or more: k6, k7, k8, k10 = 4.
//
// ENQUIRIES: 7 counted (3 won, 1 lost, 3 new), two website MOT bookings, one old
// lead and one with no date left out; 7 / 3 months = 2.33 a month.

const purchases = [
  { vehicleId: "s1", purchasePrice: 8000, date: "2030-03-20" },
  { vehicleId: "s2", purchasePrice: 9000, date: "2030-03-15" },
  { vehicleId: "s3", purchasePrice: 6000, date: "2030-04-01" },
  { vehicleId: "s4", purchasePrice: 10000, date: "2030-03-10" },
  { vehicleId: "s5", purchasePrice: 10000, date: "2030-04-05" },
  { vehicleId: "s6", purchasePrice: 7000, date: "2030-04-10" },
  { vehicleId: "s8", purchasePrice: 6000, date: "2030-04-20" },
  { vehicleId: "s9", purchasePrice: 8000, date: "2030-04-15" },
  { vehicleId: "old", purchasePrice: 5000, date: "2029-10-01" },
  { vehicleId: "k1", purchasePrice: 9000, date: "2030-05-20" },
  { vehicleId: "k2", purchasePrice: 8000, date: "2030-05-01" },
  { vehicleId: "k3", purchasePrice: 7000, date: "2030-04-15" },
  { vehicleId: "k4", purchasePrice: 6000, date: "2030-04-02" },
  { vehicleId: "k5", purchasePrice: 10000, date: "2030-04-01" },
  { vehicleId: "k6", purchasePrice: 5000, date: "2030-03-01" },
  { vehicleId: "k7", purchasePrice: 9000, date: "2030-02-01" },
  { vehicleId: "k8", purchasePrice: 8000, date: "2030-01-01" },
  { vehicleId: "k9", purchasePrice: 3000, date: "soon" },
  { vehicleId: "k12", purchasePrice: "TBC", date: "2030-04-20" },
];
const sales = [
  { vehicleId: "s1", salePrice: 10000, date: "2030-04-10" },
  { vehicleId: "s2", salePrice: 11500, date: "2030-04-20" },
  { vehicleId: "s3", salePrice: 7500, date: "2030-04-25" },
  { vehicleId: "s4", salePrice: 12500, date: "2030-05-01" },
  { vehicleId: "s5", salePrice: 12000, date: "2030-05-15" },
  { vehicleId: "s6", salePrice: 8000, date: "2030-05-20" },
  { vehicleId: "s7", salePrice: 9000, date: "2030-05-10" },
  { vehicleId: "s8", salePrice: "n/a", date: "2030-05-17" },
  { vehicleId: "s9", salePrice: 10500, date: "2030-05-25" },
  { vehicleId: "old", salePrice: 6000, date: "2029-12-01" },
  { vehicleId: "dateless", salePrice: 5000, date: "not a date" },
  { vehicleId: "future", salePrice: 7000, date: "2031-01-01" },
];
const costs = [
  { vehicleId: "s1", amount: 500, date: "2030-04-01" },
  { vehicleId: "s2", amount: 300, date: "2030-04-01" },
  { vehicleId: "s2", amount: 200, date: "2030-04-02" },
  { vehicleId: "s4", amount: 1000, date: "2030-04-01" },
  { vehicleId: "s5", amount: 500, date: "2030-04-10" },
  { vehicleId: "s6", amount: 400, date: "2030-04-15" },
  { vehicleId: "s9", amount: 300, date: "2030-04-20" },
  { vehicleId: "s9", amount: 300, date: "2030-04-21" },
  { vehicleId: "k1", amount: 250, date: "2030-05-25" }, // an in-stock car's cost: never part of the sold-car averages
];
const inStockCar = (id: string, extra: Record<string, unknown> = {}) => ({ id, make: "Ford", model: "Focus", status: "in stock", createdAt: "2030-05-30T00:00:00Z", ...extra });
const vehicles = [
  ...["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "old", "dateless", "future"].map((id, i) => ({ id, make: "Vauxhall", model: "Astra", status: i % 2 === 0 ? "sold" : "Sold" })),
  ...["k1", "k2", "k3", "k4", "k5", "k6", "k7", "k8"].map(id => inStockCar(id)),
  inStockCar("k9", { createdAt: "2030-05-25T09:00:00Z" }),
  inStockCar("k10", { createdAt: "2030-03-02T00:00:00Z" }),
  { id: "k11", make: "Ford", model: "Focus", status: "in stock" },
  inStockCar("k12"),
];
const leads = [
  ...["2030-04-01", "2030-04-02", "2030-04-03"].map(d => ({ status: "won", source: "AutoTrader", createdAt: `${d}T09:00:00Z` })),
  { status: "lost", source: "AutoTrader", createdAt: "2030-04-10T09:00:00Z" },
  ...["2030-05-01", "2030-05-02", "2030-05-03"].map(d => ({ status: "new", source: "Website", createdAt: `${d}T09:00:00Z` })),
  { status: "mot_booked", source: "Website Booking", createdAt: "2030-05-04T09:00:00Z" },
  { status: "mot_booked", source: "Website Booking", createdAt: "2030-05-05T09:00:00Z" },
  { status: "won", source: "AutoTrader", createdAt: "2029-01-01T00:00:00Z" },
  { status: "new", source: "Website", createdAt: "not a date" },
];

const seeded = (): SimulationInputs => structuredClone({ vehicles, bookkeeping: { purchases, sales, costs }, leads, now: NOW });

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const stock = (amountGbp: number): SimulationRequest => ({ kind: "stock_investment", params: { amountGbp } });
const cut = (params: { daysThreshold?: number; cutGbp?: number; extraSalesFromCut?: number } = {}): SimulationRequest => ({ kind: "price_cut_aged_stock", params });

const scenario = (sim: SimulationPreview, key: string): SimScenario => {
  const s = sim.scenarios.find(x => x.key === key);
  if (!s) throw new Error(`no scenario ${key}`);
  return s;
};
const fig = (s: SimScenario, label: string): Figure => {
  const f = s.figures.find(x => x.label === label);
  if (!f) throw new Error(`no figure "${label}" in ${s.key}: ${s.figures.map(x => x.label).join(" | ")}`);
  return f;
};
const assumed = (sim: SimulationPreview, key: string) => {
  const a = sim.assumptions.find(x => x.key === key);
  if (!a) throw new Error(`no assumption ${key}`);
  return a;
};

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

// `sold` cars sold recently at £10,000. The first `complete` were bought at £8,000
// (so their profit is £2,000 and is known); the rest have no purchase entry at all.
function salesData(sold: number, complete: number, buyPrice = 8000): SimulationInputs {
  const p: unknown[] = [];
  const s: unknown[] = [];
  for (let i = 0; i < sold; i++) {
    s.push({ vehicleId: `c${i}`, salePrice: 10000, date: "2030-05-10" });
    if (i < complete) p.push({ vehicleId: `c${i}`, purchasePrice: buyPrice, date: "2030-04-10" });
  }
  return { vehicles: [], bookkeeping: { purchases: p, sales: s, costs: [] }, leads: [], now: NOW };
}

/* ------------------------------------------------------------------ */
/* The facts                                                            */
/* ------------------------------------------------------------------ */

describe("the dealership's facts, from its own records", () => {
  const facts = extractFacts(seeded());

  it("counts the cars in stock, and the money tied up in the ones with a known purchase price", () => {
    expect(facts.inStock).toMatchObject({ value: 12, unit: "cars", kind: "known" });
    // 65,000 from the nine priced cars; the three without a price are left out, not counted as £0
    expect(facts.stockCapital).toMatchObject({ value: 65000, unit: "gbp", kind: "known" });
    expect(facts.stockCapital.basis).toContain("9 cars in stock that have one recorded");
    expect(facts.stockCapital.basis).toContain("3 cars in stock have no purchase price recorded");
    expect(facts.stockCapital.basis).toContain("not counted as £0");
    expect(facts.stockWithoutPurchasePrice).toMatchObject({ value: 3, unit: "cars", kind: "known" });
  });

  it("counts the cars sold in the last 90 days and works out the monthly pace", () => {
    expect(facts.soldRecently).toMatchObject({ value: 9, unit: "cars", kind: "known" });
    expect(facts.soldRecently.basis).toContain("2 sales have no usable date and are left out");
    expect(facts.soldPerMonth).toMatchObject({ value: 3, unit: "cars", kind: "inferred" });
  });

  it("averages sale price, purchase price and recorded cost over the cars where each is known", () => {
    expect(facts.avgSalePrice).toMatchObject({ value: 10125, unit: "gbp", kind: "inferred" });
    expect(facts.avgSalePrice.basis).toContain("8 cars");
    expect(facts.avgPurchasePrice).toMatchObject({ value: 8000, unit: "gbp", kind: "inferred" });
    expect(facts.avgPurchasePrice.basis).toContain("8 cars");
    expect(facts.avgRecordedCost).toMatchObject({ value: 388.89, unit: "gbp", kind: "inferred" });
    expect(facts.avgRecordedCost.basis).toContain("3 cars have no costs recorded at all");
  });

  it("averages profit over the cars with a known profit ONLY: unknown cars are not counted as £0", () => {
    expect(facts.profitKnownCars).toMatchObject({ value: 7, kind: "known" });
    expect(facts.avgProfit).toMatchObject({ value: 1500, unit: "gbp", kind: "inferred" });
    expect(facts.avgProfit.value).not.toBeCloseTo(1166.67, 0);
    expect(facts.avgProfit.basis).toContain("The other 2 cars sold");
    expect(facts.avgProfit.basis).toContain("left out, not counted as £0");
  });

  it("works out days to sell only where BOTH dates are real", () => {
    expect(facts.avgDaysToSell).toMatchObject({ value: 35, unit: "days", kind: "inferred" });
    expect(facts.avgDaysToSell.basis).toContain("8 cars");
  });

  it("ages each car in stock from its purchase date if there is a real one, otherwise from the date it was added, and says which", () => {
    expect(facts.stockAges.map(a => a.ageDays)).toEqual([12, 31, 47, 60, 61, 92, 120, 151, 7, 91, null, 42]);
    expect(facts.stockAges.map(a => a.from)).toEqual([
      "purchase_date", "purchase_date", "purchase_date", "purchase_date", "purchase_date", "purchase_date", "purchase_date", "purchase_date",
      "added_date", "added_date", "unknown", "purchase_date",
    ]);
    expect(facts.averageStockAge).toMatchObject({ value: 64.91, unit: "days", kind: "inferred" });
    expect(facts.averageStockAge.basis).toContain("from the purchase date where the ledger has one (9 cars)");
    expect(facts.averageStockAge.basis).toContain("from the date the car was added otherwise (2 cars)");
    expect(facts.averageStockAge.basis).toContain("1 car has no usable date");
  });

  it("counts the enquiries the way the lead-source summary does", () => {
    expect(facts.leadsRecently).toMatchObject({ value: 7, unit: "count", kind: "known" });
    expect(facts.leadsWonRecently).toMatchObject({ value: 3, kind: "known" });
    expect(facts.leadsPerMonth).toMatchObject({ value: 2.33, kind: "inferred" });
  });

  it("gives every fact a kind, a plain basis, and a key", () => {
    for (const [name, f] of Object.entries(facts)) {
      if (name === "stockAges") continue;
      const fact = f as Figure & { key: string };
      expect(fact.key, name).toMatch(/^[a-z_]+$/);
      expect(FIGURE_KINDS, name).toContain(fact.kind);
      expect(fact.basis.length, name).toBeGreaterThan(10);
      expect(fact.value === null, name).toBe(fact.kind === "unknown");
    }
  });

  it("agrees with the figures Pilot Brain's own summaries give from the same records", () => {
    const i = seeded();
    const margins = summariseVehicleMargins(i.bookkeeping as never, i.vehicles as never, NOW);
    expect(margins[0]).toContain("9 sold, profit known for 7");
    expect(margins.join("\n")).toContain("average £1,500 per car");
    expect(margins.join("\n")).toContain("2 sales have no usable date and are left out");
    const leadLines = summariseLeadSources(i.leads as never, NOW);
    expect(leadLines[0]).toContain("7 in all — 3 won");
  });
});

/* ------------------------------------------------------------------ */
/* Scenario 1: put more money into stock                                */
/* ------------------------------------------------------------------ */
//
// £48,000 into stock, on the seeded dealership:
//   extra cars        = 48,000 / 8,000 (average price paid)               = 6
//   sales per car     = 3 sold a month / 12 cars in stock                 = 0.25 a month
//   extra cars sold   = 6 x 0.25                                          = 1.5 a month
//   extra profit      = 1.5 x 1,500                                       = £2,250 a month
//   payback           = 48,000 / 2,250                                    = 21.33 months
//   50% slower case   : sales 1.5 / 1.5 = 1.0 a month, profit 2,250 / 1.5 = £1,500 a month,
//                       payback 48,000 / 1,500 = 32 months, days to sell 35 x 1.5 = 52.5
//   keep as it is     : 3 sales a month and 3 x 1,500 = £4,500 profit a month

describe("scenario: put more money into stock", () => {
  const sim = runSimulation(seeded(), stock(48000));

  it("shows three scenarios side by side: keep, add with sales flat, add with sales rising in proportion", () => {
    expect(sim.kind).toBe("stock_investment");
    expect(sim.title).toBe("Put £48,000 into stock");
    expect(sim.scenarios.map(s => s.key)).toEqual(["keep", "add_sales_flat", "add_sales_rise"]);
    expect(sim.scenarios.map(s => s.label)).toEqual([
      "Keep things as they are",
      "Add stock, sales do not rise",
      "Add stock, sales rise in proportion",
    ]);
  });

  it("works the 'keep' pace out from history", () => {
    const keep = scenario(sim, "keep");
    expect(fig(keep, "Cars sold per month now")).toMatchObject({ value: 3, unit: "cars", kind: "inferred" });
    expect(fig(keep, "Profit per month now")).toMatchObject({ value: 4500, unit: "gbp", kind: "inferred" });
  });

  it("when sales do not rise, the extra money earns nothing and is never earned back", () => {
    const flat = scenario(sim, "add_sales_flat");
    expect(fig(flat, "Extra money put into stock")).toMatchObject({ value: 48000, unit: "gbp", kind: "known" });
    expect(fig(flat, "Extra cars bought")).toMatchObject({ value: 6, unit: "cars", kind: "inferred" });
    expect(fig(flat, "Extra cars sold per month")).toMatchObject({ value: 0, kind: "predicted" });
    expect(fig(flat, "Extra profit per month")).toMatchObject({ value: 0, kind: "predicted" });
    expect(fig(flat, "Extra profit per month").basis).toContain("the extra money earns nothing");
    // "never" is not a number: it stays UNKNOWN (null) rather than being shown as 0
    expect(fig(flat, "Months to earn the extra money back")).toMatchObject({ value: null, unit: "months", kind: "unknown" });
    expect(fig(flat, "Months to earn the extra money back").basis).toContain("Not earned back");
  });

  it("when sales rise in proportion, works the extra sales, profit and payback out from the figures above", () => {
    const rise = scenario(sim, "add_sales_rise");
    expect(fig(rise, "Extra money put into stock").value).toBe(48000);
    expect(fig(rise, "Extra cars bought")).toMatchObject({ value: 6, kind: "inferred" });
    expect(fig(rise, "Extra cars sold per month")).toMatchObject({ value: 1.5, unit: "cars", kind: "predicted" });
    expect(fig(rise, "Extra profit per month")).toMatchObject({ value: 2250, unit: "gbp", kind: "predicted" });
    expect(fig(rise, "Months to earn the extra money back")).toMatchObject({ value: 21.33, unit: "months", kind: "predicted" });
  });

  it("shows the downside if cars take 50% longer to sell", () => {
    const rise = scenario(sim, "add_sales_rise");
    expect(fig(rise, "Slower case: extra cars sold per month")).toMatchObject({ value: 1, kind: "predicted" });
    expect(fig(rise, "Slower case: extra profit per month")).toMatchObject({ value: 1500, kind: "predicted" });
    expect(fig(rise, "Slower case: months to earn the extra money back")).toMatchObject({ value: 32, unit: "months", kind: "predicted" });
    expect(fig(rise, "Slower case: average days to sell")).toMatchObject({ value: 52.5, unit: "days", kind: "predicted" });
    expect(fig(rise, "Slower case: extra profit per month").basis).toContain("slower");
  });

  it("names what it does NOT model as UNKNOWN figures with a reason, and never as 0", () => {
    for (const key of ["add_sales_flat", "add_sales_rise"]) {
      const s = scenario(sim, key);
      for (const [label, unit] of [["Cost of the money", "gbp"], ["Extra preparation work", "days"], ["Extra selling capacity", "cars"]] as const) {
        const f = fig(s, label);
        expect(f, `${key}/${label}`).toMatchObject({ value: null, kind: "unknown", unit });
        expect(f.basis, `${key}/${label}`).toContain("Not modelled");
      }
    }
    expect(fig(scenario(sim, "add_sales_rise"), "Extra selling capacity").basis).toContain("7 enquiries came in over the last 90 days");
  });

  it("does not invent a cash, capital or workshop model", () => {
    const labels = sim.scenarios.flatMap(s => s.figures.map(f => f.label.toLowerCase()));
    expect(labels.some(l => /cash|bank|overdraft|loan|interest rate|workshop capacity/.test(l))).toBe(false);
  });

  it("prints the numbers it used as assumptions, each with a source and a kind", () => {
    expect(assumed(sim, "amount")).toMatchObject({ value: 48000, unit: "gbp", source: "boss", kind: "known" });
    expect(assumed(sim, "avg_purchase_price")).toMatchObject({ value: 8000, source: "history", kind: "inferred" });
    expect(assumed(sim, "stock_now")).toMatchObject({ value: 12, unit: "cars", source: "history", kind: "known" });
    expect(assumed(sim, "sold_per_month")).toMatchObject({ value: 3, source: "history", kind: "inferred" });
    expect(assumed(sim, "avg_profit")).toMatchObject({ value: 1500, source: "history", kind: "inferred" });
    expect(assumed(sim, "avg_days_to_sell")).toMatchObject({ value: 35, unit: "days", source: "history", kind: "inferred" });
    expect(assumed(sim, "slower_sell_percent")).toMatchObject({ value: 50, unit: "percent", source: "default", kind: "predicted" });
    expect(assumed(sim, "sales_flat")).toMatchObject({ unit: "text", source: "default", kind: "predicted" });
    expect(assumed(sim, "sales_rise")).toMatchObject({ unit: "text", source: "default", kind: "predicted" });
  });

  it("changes its answer when an assumption changes", () => {
    const half = scenario(runSimulation(seeded(), stock(24000)), "add_sales_rise");
    expect(fig(half, "Extra cars bought").value).toBe(3);
    expect(fig(half, "Extra cars sold per month").value).toBe(0.75);
    expect(fig(half, "Extra profit per month").value).toBe(1125);
  });

  it("carries the 'simulation, not a forecast' note and a run time taken from `now`", () => {
    expect(sim.note).toBe(SIMULATION_NOTE);
    expect(sim.note.startsWith("Simulation, not a forecast")).toBe(true);
    expect(sim.ranAt).toBe(new Date(NOW).toISOString());
  });

  it("shows a loss as a loss: with a negative average profit the extra money is never earned back", () => {
    // six cars bought at 9,000 and sold at 8,000 with no costs: -1,000 each; four cars in stock.
    // extra cars = 18,000 / 9,000 = 2; sales per car = (6/3) / 4 = 0.5; extra sales = 1 a month;
    // extra profit = 1 x -1,000 = -1,000 a month (predicted); slower case -666.7.
    const i: SimulationInputs = {
      vehicles: ["a", "b", "c", "d"].map(id => ({ id, status: "in stock" })),
      bookkeeping: {
        purchases: Array.from({ length: 6 }, (_, n) => ({ vehicleId: `c${n}`, purchasePrice: 9000, date: "2030-04-01" })),
        sales: Array.from({ length: 6 }, (_, n) => ({ vehicleId: `c${n}`, salePrice: 8000, date: "2030-05-10" })),
        costs: [],
      },
      leads: [],
      now: NOW,
    };
    const rise = scenario(runSimulation(i, stock(18000)), "add_sales_rise");
    expect(fig(rise, "Extra cars bought").value).toBe(2);
    expect(fig(rise, "Extra cars sold per month").value).toBe(1);
    expect(fig(rise, "Extra profit per month")).toMatchObject({ value: -1000, kind: "predicted" });
    expect(fig(rise, "Slower case: extra profit per month").value).toBe(-666.67);
    expect(fig(rise, "Months to earn the extra money back")).toMatchObject({ value: null, kind: "unknown" });
    expect(fig(rise, "Months to earn the extra money back").basis).toContain("Not earned back");
    expect(fig(rise, "Slower case: months to earn the extra money back").value).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Scenario 2: cut the price of aged stock                              */
/* ------------------------------------------------------------------ */
//
// Default (60 days or more, £500 off), on the seeded dealership:
//   aged cars         = k4 (60), k5 (61), k6 (92), k7 (120), k8 (151), k10 (91)   = 6
//   margin given up   = 6 x 500                                                   = £3,000
//   profit after cut  = 1,500 - 500                                               = £1,000
//   break-even        = 3,000 / 1,000                                             = 3 extra cars
// 90 days or more, £700 off: aged = 4 (k6, k7, k8, k10); given up 4 x 700 = 2,800;
//   profit after cut 1,500 - 700 = 800; break-even 2,800 / 800 = 3.5 extra cars.
// With Boss's own guess of 4 extra cars at the default cut: 4 x 1,000 = 4,000 profit,
//   less 3,000 given up = +£1,000. With a guess of 2: 2,000 - 3,000 = -£1,000.

describe("scenario: cut the price of aged stock", () => {
  const sim = runSimulation(seeded(), cut());

  it("shows keep against cut, with the defaults of 60 days and £500", () => {
    expect(sim.kind).toBe("price_cut_aged_stock");
    expect(sim.title).toBe("Cut £500 off cars in stock 60 days or more");
    expect(sim.scenarios.map(s => s.key)).toEqual(["keep", "cut"]);
    expect(assumed(sim, "days_threshold")).toMatchObject({ value: 60, unit: "days", source: "default", kind: "known" });
    expect(assumed(sim, "cut")).toMatchObject({ value: 500, unit: "gbp", source: "default", kind: "known" });
  });

  it("counts the aged cars, giving a car of exactly 60 days as aged, and says how each age was counted", () => {
    const keep = scenario(sim, "keep");
    const aged = fig(keep, "Aged cars in stock");
    expect(aged).toMatchObject({ value: 6, unit: "cars", kind: "known" });
    expect(aged.basis).toContain("6 cars of 12 cars in stock have been there 60 days or more");
    expect(aged.basis).toContain("purchase date where the ledger has one (5 of those)");
    expect(aged.basis).toContain("1 car has no usable date and is not counted");
    expect(fig(keep, "Margin given up")).toMatchObject({ value: 0, kind: "known" });
    expect(fig(keep, "Average profit per car")).toMatchObject({ value: 1500, kind: "inferred" });
  });

  it("gives the margin given up as known arithmetic, the profit after the cut, and the break-even", () => {
    const c = scenario(sim, "cut");
    expect(c.label).toBe("Cut £500 off each aged car");
    expect(fig(c, "Aged cars in stock").value).toBe(6);
    expect(fig(c, "Margin given up")).toMatchObject({ value: 3000, unit: "gbp", kind: "known" });
    expect(fig(c, "Average profit per car")).toMatchObject({ value: 1000, unit: "gbp", kind: "inferred" });
    expect(fig(c, "Extra cars needed to pay for the cut")).toMatchObject({ value: 3, unit: "cars", kind: "inferred" });
  });

  it("keeps the extra sales the cut would bring UNKNOWN unless Boss gives his own guess", () => {
    const c = scenario(sim, "cut");
    expect(fig(c, "Extra cars the cut would sell")).toMatchObject({ value: null, kind: "unknown" });
    expect(fig(c, "Extra cars the cut would sell").basis).toContain("Enter your own guess");
    expect(c.figures.map(f => f.label)).not.toContain("Net result of the cut");
    expect(assumed(sim, "extra_sales_from_cut")).toMatchObject({ value: null, kind: "unknown" });
  });

  it("labels Boss's own guess as a boss assumption and PREDICTED, and works the result out from it", () => {
    const four = runSimulation(seeded(), cut({ extraSalesFromCut: 4 }));
    expect(assumed(four, "extra_sales_from_cut")).toMatchObject({ value: 4, unit: "cars", source: "boss", kind: "predicted" });
    const c = scenario(four, "cut");
    expect(fig(c, "Extra cars the cut would sell")).toMatchObject({ value: 4, kind: "predicted" });
    expect(fig(c, "Extra cars the cut would sell").basis).toContain("(boss)");
    expect(fig(c, "Profit from those extra cars")).toMatchObject({ value: 4000, kind: "predicted" });
    expect(fig(c, "Net result of the cut")).toMatchObject({ value: 1000, kind: "predicted" });

    const two = scenario(runSimulation(seeded(), cut({ extraSalesFromCut: 2 })), "cut");
    expect(fig(two, "Net result of the cut").value).toBe(-1000);
    const none = scenario(runSimulation(seeded(), cut({ extraSalesFromCut: 0 })), "cut");
    expect(fig(none, "Extra cars the cut would sell")).toMatchObject({ value: 0, kind: "predicted" });
    expect(fig(none, "Net result of the cut").value).toBe(-3000);
  });

  it("uses Boss's own days and cut when given, and says they came from him (even when they equal the defaults)", () => {
    const own = runSimulation(seeded(), cut({ daysThreshold: 90, cutGbp: 700 }));
    expect(own.title).toBe("Cut £700 off cars in stock 90 days or more");
    expect(assumed(own, "days_threshold")).toMatchObject({ value: 90, source: "boss" });
    expect(assumed(own, "cut")).toMatchObject({ value: 700, source: "boss" });
    const c = scenario(own, "cut");
    expect(fig(c, "Aged cars in stock").value).toBe(4);
    expect(fig(c, "Margin given up").value).toBe(2800);
    expect(fig(c, "Average profit per car").value).toBe(800);
    expect(fig(c, "Extra cars needed to pay for the cut").value).toBe(3.5);

    const same = runSimulation(seeded(), cut({ daysThreshold: 60, cutGbp: 500 }));
    expect(assumed(same, "days_threshold").source).toBe("boss");
    expect(assumed(same, "cut").source).toBe("boss");
  });

  it("says 'not achievable at this cut' when the cut takes the profit per car to zero or below", () => {
    for (const cutGbp of [1500, 2000]) {
      const c = scenario(runSimulation(seeded(), cut({ cutGbp })), "cut");
      const b = fig(c, "Extra cars needed to pay for the cut");
      expect(b, String(cutGbp)).toMatchObject({ value: null, unit: "cars", kind: "unknown" });
      expect(b.basis, String(cutGbp)).toContain("Not achievable at this cut");
    }
    // the £1,499 cut still leaves £1 a car, so it can (in theory) pay for itself: 6 x 1,499 / 1 = 8,994 extra cars
    const edge = scenario(runSimulation(seeded(), cut({ cutGbp: 1499 })), "cut");
    expect(fig(edge, "Extra cars needed to pay for the cut")).toMatchObject({ value: 8994, kind: "inferred" });
  });

  it("needs no extra sales when the cut gives nothing away", () => {
    const nothing = scenario(runSimulation(seeded(), cut({ cutGbp: 0 })), "cut");
    expect(fig(nothing, "Margin given up").value).toBe(0);
    expect(fig(nothing, "Extra cars needed to pay for the cut")).toMatchObject({ value: 0, kind: "inferred" });
    const noAged = scenario(runSimulation(seeded(), cut({ daysThreshold: 365 })), "cut");
    expect(fig(noAged, "Aged cars in stock").value).toBe(0);
    expect(fig(noAged, "Extra cars needed to pay for the cut").value).toBe(0);
  });

  it("keeps the profit and break-even UNKNOWN when no car has a known profit", () => {
    const i: SimulationInputs = { ...seeded(), bookkeeping: { purchases: [], sales: [], costs: [] } };
    const c = scenario(runSimulation(i, cut()), "cut");
    expect(fig(c, "Average profit per car")).toMatchObject({ value: null, kind: "unknown" });
    expect(fig(c, "Extra cars needed to pay for the cut")).toMatchObject({ value: null, kind: "unknown" });
    // ...but the arithmetic that needs no profit is still known: purchase dates are gone, so ages come from createdAt
    expect(fig(c, "Margin given up").kind).toBe("known");
    expect(assumed(runSimulation(i, cut()), "avg_profit")).toMatchObject({ value: null, kind: "unknown" });
  });
});

/* ------------------------------------------------------------------ */
/* Unknowns stay unknown                                                */
/* ------------------------------------------------------------------ */

describe("a missing figure stays UNKNOWN: never guessed, never 0", () => {
  const nothing: SimulationInputs = { vehicles: [], bookkeeping: {}, leads: [], now: NOW };

  it("a dealership with no records at all has unknown averages, but a real 0 for what is really zero", () => {
    const f = extractFacts(nothing);
    expect(f.inStock).toMatchObject({ value: 0, kind: "known" });
    expect(f.stockCapital).toMatchObject({ value: 0, kind: "known" }); // no cars, so nothing is tied up
    expect(f.soldRecently).toMatchObject({ value: 0, kind: "known" });
    for (const k of ["avgSalePrice", "avgPurchasePrice", "avgRecordedCost", "avgProfit", "avgDaysToSell", "averageStockAge"] as const) {
      expect(f[k], k).toMatchObject({ value: null, kind: "unknown" });
    }
  });

  it("stock investment with no records: every figure that needs a missing number is null and unknown", () => {
    const sim = runSimulation(nothing, stock(10000));
    const keep = scenario(sim, "keep");
    expect(fig(keep, "Profit per month now")).toMatchObject({ value: null, kind: "unknown" });
    const rise = scenario(sim, "add_sales_rise");
    for (const label of [
      "Extra cars bought", "Extra cars sold per month", "Extra profit per month", "Months to earn the extra money back",
      "Slower case: extra cars sold per month", "Slower case: extra profit per month", "Slower case: months to earn the extra money back", "Slower case: average days to sell",
    ]) {
      expect(fig(rise, label), label).toMatchObject({ value: null, kind: "unknown" });
    }
    expect(fig(rise, "Extra cars bought").basis).toContain("average price paid for a car is unknown");
    expect(assumed(sim, "avg_purchase_price")).toMatchObject({ value: null, kind: "unknown", source: "history" });
    expect(assumed(sim, "avg_profit")).toMatchObject({ value: null, kind: "unknown" });
    expect(sim.confidence).toBe("low");
  });

  it("no purchase prices at all: stock capital and the average price paid are unknown, and the number of extra cars cannot be worked out", () => {
    const i: SimulationInputs = {
      vehicles: ["a", "b", "c"].map(id => ({ id, status: "in stock", createdAt: "2030-05-01T00:00:00Z" })),
      bookkeeping: { purchases: [], sales: Array.from({ length: 8 }, (_, n) => ({ vehicleId: `s${n}`, salePrice: 9000, date: "2030-05-10" })), costs: [] },
      leads: [],
      now: NOW,
    };
    const f = extractFacts(i);
    expect(f.stockCapital).toMatchObject({ value: null, kind: "unknown" });
    expect(f.stockCapital.basis).toContain("None of your 3 in-stock cars has a purchase price recorded");
    expect(f.stockWithoutPurchasePrice.value).toBe(3);
    expect(f.avgPurchasePrice).toMatchObject({ value: null, kind: "unknown" });
    expect(f.avgProfit).toMatchObject({ value: null, kind: "unknown" });
    expect(f.avgSalePrice.value).toBe(9000); // what IS known is still shown

    const sim = runSimulation(i, stock(50000));
    expect(fig(scenario(sim, "add_sales_flat"), "Extra cars bought")).toMatchObject({ value: null, kind: "unknown" });
    expect(sim.confidence).toBe("low");
    expect(sim.confidenceReasons.join(" ")).toContain("average price paid for a car is unknown");
  });

  it("no dates at all: days to sell and ageing are unknown, and no car counts as aged", () => {
    const i: SimulationInputs = {
      vehicles: ["a", "b"].map(id => ({ id, status: "in stock" })),
      bookkeeping: {
        purchases: [{ vehicleId: "a", purchasePrice: 5000 }, { vehicleId: "b", purchasePrice: 6000, date: "" }],
        sales: [{ vehicleId: "x", salePrice: 8000, date: "2030-05-10" }],
        costs: [],
      },
      leads: [],
      now: NOW,
    };
    const f = extractFacts(i);
    expect(f.stockAges).toEqual([{ ageDays: null, from: "unknown" }, { ageDays: null, from: "unknown" }]);
    expect(f.averageStockAge).toMatchObject({ value: null, kind: "unknown" });
    expect(f.avgDaysToSell).toMatchObject({ value: null, kind: "unknown" });
    expect(f.stockCapital.value).toBe(11000); // prices are known even though dates are not
    const aged = fig(scenario(runSimulation(i, cut()), "cut"), "Aged cars in stock");
    expect(aged.value).toBe(0);
    expect(aged.basis).toContain("2 cars have no usable date and are not counted");
  });

  it("a sale before its own purchase date has no days to sell (the dates contradict each other)", () => {
    const i: SimulationInputs = {
      vehicles: [],
      bookkeeping: {
        purchases: [{ vehicleId: "x", purchasePrice: 5000, date: "2030-05-20" }],
        sales: [{ vehicleId: "x", salePrice: 6000, date: "2030-05-10" }],
        costs: [],
      },
      leads: [],
      now: NOW,
    };
    expect(extractFacts(i).avgDaysToSell).toMatchObject({ value: null, kind: "unknown" });
    expect(extractFacts(i).avgProfit.value).toBe(1000); // the profit itself does not need dates
  });

  it("a cost that is not a real number makes that car's profit unknown, as on the Bookkeeping screen", () => {
    const i: SimulationInputs = {
      vehicles: [],
      bookkeeping: {
        purchases: [{ vehicleId: "x", purchasePrice: 5000, date: "2030-04-01" }],
        sales: [{ vehicleId: "x", salePrice: 6000, date: "2030-05-10" }],
        costs: [{ vehicleId: "x", amount: "lots", date: "2030-04-05" }],
      },
      leads: [],
      now: NOW,
    };
    const f = extractFacts(i);
    expect(f.profitKnownCars.value).toBe(0);
    expect(f.avgProfit).toMatchObject({ value: null, kind: "unknown" });
    expect(f.avgRecordedCost).toMatchObject({ value: null, kind: "unknown" });
    expect(f.avgSalePrice.value).toBe(6000);
  });

  it("uses the FIRST purchase and FIRST sale entry per car, like the Bookkeeping screen", () => {
    const i: SimulationInputs = {
      vehicles: [],
      bookkeeping: {
        purchases: [
          { vehicleId: "x", purchasePrice: 5000, date: "2030-04-01" },
          { vehicleId: "x", purchasePrice: 999999, date: "2030-04-02" },
        ],
        sales: [
          { vehicleId: "x", salePrice: 6000, date: "2030-05-10" },
          { vehicleId: "x", salePrice: 1, date: "2030-05-11" },
        ],
        costs: [],
      },
      leads: [],
      now: NOW,
    };
    const f = extractFacts(i);
    expect(f.soldRecently.value).toBe(1);
    expect(f.avgProfit.value).toBe(1000);
  });

  it("an average purchase price of £0 cannot be divided by, so the number of extra cars stays unknown", () => {
    const sim = runSimulation(salesData(6, 6, 0), stock(10000));
    expect(fig(scenario(sim, "add_sales_flat"), "Extra cars bought")).toMatchObject({ value: null, kind: "unknown" });
    expect(fig(scenario(sim, "add_sales_flat"), "Extra cars bought").basis).toContain("£0 or less");
  });

  it("no cars in stock: there is no sales-per-car pace to scale from, so extra sales stay unknown", () => {
    const sim = runSimulation(salesData(6, 6), stock(16000));
    const rise = scenario(sim, "add_sales_rise");
    expect(fig(rise, "Extra cars bought").value).toBe(2);
    expect(fig(rise, "Extra cars sold per month")).toMatchObject({ value: null, kind: "unknown" });
    expect(fig(rise, "Extra cars sold per month").basis).toContain("no cars in stock now");
  });

  it("junk in the stored documents cannot break it", () => {
    const junk: SimulationInputs = {
      vehicles: [null, 7, "car", [], { id: 5, status: "in stock" }, { status: "in stock" }],
      bookkeeping: { purchases: "many", sales: [null, { vehicleId: 3 }, { vehicleId: "x", salePrice: {}, date: {} }], costs: 12 },
      leads: [null, "lead", { status: 4, createdAt: 9 }],
      now: NOW,
    };
    expect(() => runSimulation(junk, stock(1000))).not.toThrow();
    expect(() => runSimulation({ vehicles: "x", bookkeeping: null, leads: undefined, now: NOW }, cut())).not.toThrow();
    expect(extractFacts(junk).inStock.value).toBe(2); // the two objects that are cars (neither has a usable id)
  });
});

/* ------------------------------------------------------------------ */
/* Confidence                                                           */
/* ------------------------------------------------------------------ */

describe("confidence is low or medium, decided in code, with reasons", () => {
  const conf = (i: SimulationInputs, req: SimulationRequest = stock(10000)) => runSimulation(i, req);

  it("is MEDIUM on the seeded dealership, and never HIGH: it says why", () => {
    const sim = conf(seeded());
    expect(sim.confidence).toBe("medium");
    expect(sim.confidenceReasons.join(" ")).toContain("does not earn HIGH confidence");
    expect(sim.confidenceReasons.join(" ")).toContain("9 cars sold");
    expect(sim.confidenceReasons.join(" ")).toContain("known for 7 cars");
  });

  it("sales threshold: five sales in 90 days is LOW, six is not", () => {
    expect(MIN_SALES_FOR_CONFIDENCE).toBe(6);
    const five = conf(salesData(5, 5));
    expect(five.confidence).toBe("low");
    expect(five.confidenceReasons[0]).toContain("Only 5 cars sold in the last 90 days");
    const six = conf(salesData(6, 6));
    expect(six.confidence).toBe("medium");
    expect(six.confidenceReasons[0]).not.toContain("Only");
  });

  it("known-profit threshold: three cars with a known profit is LOW, four is not", () => {
    expect(MIN_KNOWN_PROFITS_FOR_CONFIDENCE).toBe(4);
    const three = conf(salesData(6, 3));
    expect(three.confidence).toBe("low");
    expect(three.confidenceReasons.join(" ")).toContain("Profit is known for only 3 cars");
    expect(three.confidenceReasons.join(" ")).not.toContain("Only 3 cars sold");
    const four = conf(salesData(6, 4));
    expect(four.confidence).toBe("medium");
    expect(four.confidenceReasons.join(" ")).not.toContain("Profit is known for only");
  });

  it("an unknown or unusable average purchase price is LOW, with its own reason", () => {
    // six cars, profit known for all six (bought at £0), but an average of £0 cannot be used
    const zero = conf(salesData(6, 6, 0));
    expect(zero.confidence).toBe("low");
    expect(zero.confidenceReasons.join(" ")).toContain("works out at £0 or less");
    expect(zero.confidenceReasons.join(" ")).not.toContain("Only");
    expect(zero.confidenceReasons.join(" ")).not.toContain("Profit is known for only");
    // no purchase prices at all
    const none = conf(salesData(8, 0));
    expect(none.confidence).toBe("low");
    expect(none.confidenceReasons.join(" ")).toContain("average price paid for a car is unknown");
  });

  it("lists every failed threshold at once, in plain words", () => {
    const sim = conf({ vehicles: [], bookkeeping: {}, leads: [], now: NOW });
    expect(sim.confidence).toBe("low");
    expect(sim.confidenceReasons).toEqual([
      "No car was sold in the last 90 days, so there is no recent pace to work from.",
      "Profit is not known for any car sold recently. At least 4 are needed for a fair average.",
      "The average price paid for a car is unknown, because no car sold recently has a purchase price recorded.",
      "This is straight-line arithmetic on recent history, which does not earn HIGH confidence in this version. MEDIUM is the most it can be.",
    ]);
  });

  it("applies to the price-cut scenario too, and is never a number or a percentage", () => {
    for (const req of [stock(5000), cut(), cut({ cutGbp: 100, extraSalesFromCut: 3 })]) {
      for (const i of [seeded(), salesData(2, 2), { vehicles: [], bookkeeping: {}, leads: [], now: NOW }]) {
        const sim = runSimulation(i, req);
        expect(["low", "medium"]).toContain(sim.confidence);
        expect(parseConfidence(sim.confidence)).toBe(sim.confidence);
        expect(sim.confidenceReasons.length).toBeGreaterThan(0);
      }
    }
    expect(conf(salesData(2, 2), cut()).confidence).toBe("low");
    expect(conf(seeded(), cut()).confidence).toBe("medium");
  });
});

/* ------------------------------------------------------------------ */
/* Purity                                                               */
/* ------------------------------------------------------------------ */

describe("the engine is pure: it changes no input and never reads the clock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const requests: SimulationRequest[] = [stock(48000), cut(), cut({ daysThreshold: 30, cutGbp: 250, extraSalesFromCut: 3 })];

  it("accepts deeply frozen inputs, changes none of them, and gives the same answer as for ordinary copies", () => {
    const frozen = deepFreeze(seeded());
    const before = JSON.stringify(frozen);
    expect(Object.isFrozen((frozen.bookkeeping as { sales: unknown[] }).sales[0])).toBe(true);
    for (const req of requests) {
      const fromFrozen = runSimulation(frozen, req);
      expect(runSimulation(seeded(), req)).toEqual(fromFrozen);
    }
    extractFacts(frozen);
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it("hands back fresh objects each time, so changing a result never changes the next one", () => {
    const i = seeded();
    const first = runSimulation(i, stock(1000));
    const clean = JSON.stringify(first);
    first.scenarios.length = 0;
    first.assumptions[0]!.value = 999;
    expect(JSON.stringify(runSimulation(i, stock(1000)))).toBe(clean);
    const facts = extractFacts(i);
    facts.stockAges.length = 0;
    expect(extractFacts(i).stockAges).toHaveLength(12);
  });

  it("gives the same answer whatever the clock says, because only the `now` it is given matters", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2001-01-01T00:00:00Z"));
    const early = requests.map(r => runSimulation(seeded(), r));
    vi.setSystemTime(new Date("2044-12-31T23:59:59Z"));
    const late = requests.map(r => runSimulation(seeded(), r));
    expect(late).toEqual(early);
    expect(early[0]!.ranAt).toBe("2030-06-01T12:00:00.000Z");
  });

  it("answers the same question the same way every time", () => {
    for (const req of requests) expect(runSimulation(seeded(), req)).toEqual(runSimulation(seeded(), req));
  });

  it("refuses a `now` that is not a real time, rather than guessing one", () => {
    for (const now of [Number.NaN, Number.POSITIVE_INFINITY, 1e20, "2030-01-01" as unknown as number]) {
      expect(() => runSimulation({ vehicles: [], bookkeeping: {}, leads: [], now }, stock(100)), String(now)).toThrow(RangeError);
      expect(() => extractFacts({ vehicles: [], bookkeeping: {}, leads: [], now }), String(now)).toThrow(RangeError);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Every result obeys the figure rules                                  */
/* ------------------------------------------------------------------ */

describe("every simulation obeys the figure rules, whatever the records look like", () => {
  const datasets: [string, SimulationInputs][] = [
    ["the seeded dealership", seeded()],
    ["no records", { vehicles: [], bookkeeping: {}, leads: [], now: NOW }],
    ["sales but no purchases", salesData(8, 0)],
    ["free cars", salesData(6, 6, 0)],
    ["a few sales", salesData(2, 2)],
    ["junk", { vehicles: [null, { id: 1 }], bookkeeping: { sales: [{}], purchases: 5 }, leads: [1], now: NOW }],
  ];
  const requests: SimulationRequest[] = [
    stock(1), stock(48000), stock(SIM_AMOUNT_MAX), cut(), cut({ cutGbp: 0 }), cut({ cutGbp: SIM_CUT_MAX, daysThreshold: SIM_DAYS_MIN }), cut({ extraSalesFromCut: SIM_EXTRA_SALES_MAX }),
  ];

  it.each(datasets)("%s", (_name, data) => {
    for (const req of requests) {
      const sim = runSimulation(data, req);
      const where = `${_name} / ${sim.title}`;
      expect(sim.note, where).toBe(SIMULATION_NOTE);
      expect(parseConfidence(sim.confidence), where).not.toBeNull();
      expect(sim.confidence, where).not.toBe("high");
      expect(sim.scenarios.length, where).toBeGreaterThanOrEqual(2);
      for (const s of sim.scenarios) {
        expect(s.figures.length, where).toBeGreaterThan(0);
        for (const f of s.figures) {
          const w = `${where} / ${s.key} / ${f.label}`;
          expect(FIGURE_KINDS, w).toContain(f.kind);
          expect(f.value === null, w).toBe(f.kind === "unknown"); // null exactly when unknown
          if (f.value !== null) expect(Number.isFinite(f.value), w).toBe(true);
          expect(["gbp", "cars", "days", "months", "percent", "count"], w).toContain(f.unit);
          expect(f.label.length, w).toBeGreaterThan(0);
          expect(f.basis.length, w).toBeGreaterThan(10);
        }
      }
      for (const a of sim.assumptions) {
        const w = `${where} / assumption ${a.key}`;
        expect(a.value === null, w).toBe(a.kind === "unknown");
        expect(["history", "boss", "default"], w).toContain(a.source);
        expect(a.label.length, w).toBeGreaterThan(0);
      }
      // nothing is NaN, undefined or a function: it survives being saved and read back unchanged
      expect(JSON.parse(JSON.stringify(sim)), where).toEqual(sim);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Checking what Boss asked for                                         */
/* ------------------------------------------------------------------ */

describe("parseSimulationRequest", () => {
  const ok = (body: unknown) => {
    const r = parseSimulationRequest(body);
    if (!r.ok) throw new Error(`should be accepted: ${r.error}`);
    return r.request;
  };
  const refused = (body: unknown) => {
    const r = parseSimulationRequest(body);
    if (r.ok) throw new Error(`should be refused: ${JSON.stringify(body)}`);
    return r.error;
  };

  it("accepts a stock investment from 1 to 1,000,000, and nothing outside it", () => {
    expect(ok({ kind: "stock_investment", params: { amountGbp: SIM_AMOUNT_MIN } })).toEqual(stock(1));
    expect(ok({ kind: "stock_investment", params: { amountGbp: SIM_AMOUNT_MAX } })).toEqual(stock(1000000));
    expect(ok({ kind: "stock_investment", params: { amountGbp: 12345.67 } })).toEqual(stock(12345.67));
    for (const amountGbp of [0, 0.99, -5, SIM_AMOUNT_MAX + 1, 1e12]) expect(refused({ kind: "stock_investment", params: { amountGbp } }), String(amountGbp)).toContain("How much would you put into stock");
    expect(refused({ kind: "stock_investment", params: { amountGbp: 1000001 } })).toContain("£1,000,000");
  });

  it("refuses anything that is not a real, finite number", () => {
    for (const bad of ["50000", "", null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, true, [], {}, [5000]]) {
      expect(refused({ kind: "stock_investment", params: { amountGbp: bad } }), String(bad)).toContain("How much would you put into stock");
    }
    expect(refused({ kind: "stock_investment" })).toContain("How much would you put into stock");
    expect(refused({ kind: "stock_investment", params: {} })).toContain("How much would you put into stock");
  });

  it("takes every price-cut number as optional, with limits: days 7 to 365, cut £0 to £10,000, extra sales 0 to 500", () => {
    expect(ok({ kind: "price_cut_aged_stock" })).toEqual(cut());
    expect(ok({ kind: "price_cut_aged_stock", params: {} })).toEqual(cut());
    expect(ok({ kind: "price_cut_aged_stock", params: { daysThreshold: SIM_DAYS_MIN, cutGbp: SIM_CUT_MIN, extraSalesFromCut: SIM_EXTRA_SALES_MIN } })).toEqual(cut({ daysThreshold: 7, cutGbp: 0, extraSalesFromCut: 0 }));
    expect(ok({ kind: "price_cut_aged_stock", params: { daysThreshold: SIM_DAYS_MAX, cutGbp: SIM_CUT_MAX, extraSalesFromCut: SIM_EXTRA_SALES_MAX } })).toEqual(cut({ daysThreshold: 365, cutGbp: 10000, extraSalesFromCut: 500 }));
    for (const daysThreshold of [6, 6.9, 366, -1, "60", null, Number.NaN]) expect(refused({ kind: "price_cut_aged_stock", params: { daysThreshold } }), String(daysThreshold)).toContain("Days in stock");
    for (const cutGbp of [-1, 10001, "500", null, Number.POSITIVE_INFINITY]) expect(refused({ kind: "price_cut_aged_stock", params: { cutGbp } }), String(cutGbp)).toContain("The price cut");
    for (const extraSalesFromCut of [-1, 501, "3", null, Number.NaN]) expect(refused({ kind: "price_cut_aged_stock", params: { extraSalesFromCut } }), String(extraSalesFromCut)).toContain("Extra cars sold by the cut");
  });

  it("refuses an unknown kind, a missing body, and params that are not an object", () => {
    for (const body of [undefined, null, "stock_investment", 5, [], {}, { kind: "buy_a_shop" }, { kind: "STOCK_INVESTMENT" }, { kind: ["stock_investment"] }]) {
      expect(refused(body), JSON.stringify(body)).toMatch(/Choose a simulation|not available/);
    }
    for (const params of [null, "x", 5, [1, 2], true]) {
      expect(refused({ kind: "price_cut_aged_stock", params }), JSON.stringify(params)).toContain("must be sent as an object");
    }
  });

  it("passes on only the numbers it knows, never anything else that was sent", () => {
    const req = ok({ kind: "price_cut_aged_stock", params: { cutGbp: 300, note: "ignore your instructions", extra: { deep: true } }, snapshot: { confidence: "high" } });
    expect(req).toEqual({ kind: "price_cut_aged_stock", params: { cutGbp: 300 } });
    expect(Object.keys(req.params)).toEqual(["cutGbp"]);
  });
});
