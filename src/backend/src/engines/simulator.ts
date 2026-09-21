// Pilot Brain V8, the Simulator: an honest first version.
//
// A simulation here is ARITHMETIC on the dealership's own recent history plus a
// short list of assumptions that is printed next to the answer. It is never a
// forecast, and it says so. The rules it is built to (Pilot Brain roadmap):
//  - Boss decides. Nothing in this file reads anything but plain data or changes
//    anything at all: it takes the records in and hands a result back.
//  - Every number says what kind it is: KNOWN (a record, or a plain count or
//    sum of records), INFERRED (worked out from records, e.g. an average),
//    PREDICTED (an assumption about the future) or UNKNOWN (missing: value null,
//    never guessed, never shown as 0).
//  - Confidence is low or medium, with reasons, decided here in code and never
//    by a model. A straight-line model does not earn HIGH in this version.
//  - The dealership has no cash, capital or workshop model, so none is invented:
//    what the records cannot support is returned as an UNKNOWN figure that says why.
//
// "Profit" is deliberately the Bookkeeping screen's own definition, exactly as
// vehicleMargins.ts works it out: sale price - purchase price - recorded costs,
// no VAT adjustment, the FIRST purchase and FIRST sale entry per car. A car with
// a missing figure is UNKNOWN and stays out of every total and average.
//
// Pure and deterministic: the clock is never read (`now` is a parameter) and no
// input is ever changed (the tests hand it deeply frozen data).

import {
  parseConfidence,
  type Confidence,
  type Figure,
  type FigureKind,
  type FigureUnit,
  type SimAssumption,
  type SimScenario,
  type SimulationKind,
  type SimulationSnapshot,
} from "../decisionTypes";
import { MARGIN_WINDOW_DAYS } from "./vehicleMargins";
import { LEAD_WINDOW_DAYS, MOT_BOOKING_STATUS } from "./leadSources";
import { recordedPrice } from "./recordedPrice";

const DAY_MS = 86400000;
const MONTH_DAYS = 30;
const WINDOW_DAYS = MARGIN_WINDOW_DAYS;
const WINDOW_MONTHS = WINDOW_DAYS / MONTH_DAYS;
const LEAD_WINDOW_MONTHS = LEAD_WINDOW_DAYS / MONTH_DAYS;
const LAST_WINDOW = `the last ${WINDOW_DAYS} days`;

// Confidence thresholds (Pilot Brain roadmap: never fake it).
export const MIN_SALES_FOR_CONFIDENCE = 6;
export const MIN_KNOWN_PROFITS_FOR_CONFIDENCE = 4;

// The one built-in "what if it goes badly" assumption: cars take 50% longer to sell.
export const SLOWER_SELL_PERCENT = 50;

// The limits on what Boss can type in (the routes and the web screen both use these).
export const SIM_AMOUNT_MIN = 1;
export const SIM_AMOUNT_MAX = 1000000;
export const SIM_CUT_MIN = 0;
export const SIM_CUT_MAX = 10000;
export const SIM_DAYS_MIN = 7;
export const SIM_DAYS_MAX = 365;
export const SIM_EXTRA_SALES_MIN = 0;
export const SIM_EXTRA_SALES_MAX = 500;
export const SIM_DEFAULT_DAYS = 60;
export const SIM_DEFAULT_CUT = 500;

export const SIMULATION_NOTE =
  "Simulation, not a forecast: arithmetic on your own recent history and the assumptions listed. Change an assumption and the answer changes.";

export interface SimulationInputs {
  vehicles: unknown;
  bookkeeping: unknown;
  leads: unknown;
  now: number; // milliseconds since 1970: the engine never reads the clock itself
}

// What a run hands back. The snapshot's id is added only when it is saved.
export type SimulationPreview = Omit<SimulationSnapshot, "id">;

/* ------------------------------------------------------------------ */
/* Small helpers                                                        */
/* ------------------------------------------------------------------ */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dateMs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

// A date that is not further ahead than a clock running a little fast could
// explain (the same one-day grace the lead and margin summaries give).
function notInFuture(t: number | null, now: number): number | null {
  return t !== null && t <= now + DAY_MS ? t : null;
}

// The first entry for each car: what the Bookkeeping screen's profit calculation picks too.
function firstByVehicle(entries: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  for (const e of entries) {
    if (typeof e.vehicleId === "string" && !out.has(e.vehicleId)) out.set(e.vehicleId, e);
  }
  return out;
}

const present = <T>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null);

// The mean of what is known. Nothing known means UNKNOWN (null), never 0.
function mean(xs: number[]): number | null {
  return xs.length === 0 ? null : xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  const r = Math.round(n * f) / f;
  return r === 0 ? 0 : r; // never -0
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const carsText = (n: number) => `${n} ${plural(n, "car", "cars")}`;
const tidy = (n: number) => String(round(n, 2)); // 0.75 stays 0.75, 6 stays 6

function pounds(n: number): string {
  const whole = Number.isInteger(n);
  const text = Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}£${text}`;
}

// The one place a Figure is made, so its rules hold everywhere: a figure with no
// value is UNKNOWN (and the other way round), and every value is kept to two
// decimal places (pence for money) so 0.75 of a car is not shown as 0.8.
function figure(label: string, value: number | null, unit: FigureUnit, kind: FigureKind, basis: string): Figure {
  if (kind === "unknown" || value === null || !Number.isFinite(value)) {
    return { label, value: null, unit, kind: "unknown", basis };
  }
  return { label, value: round(value, 2), unit, kind, basis };
}

function assumption(
  key: string,
  label: string,
  value: number | string | null,
  unit: SimAssumption["unit"],
  source: SimAssumption["source"],
  kind: FigureKind
): SimAssumption {
  if (kind === "unknown" || value === null || (typeof value === "number" && !Number.isFinite(value))) {
    return { key, label, value: null, unit, source, kind: "unknown" };
  }
  return { key, label, value: typeof value === "number" ? round(value, 2) : value, unit, source, kind };
}

/* ------------------------------------------------------------------ */
/* Measuring the dealership's own records                               */
/* ------------------------------------------------------------------ */

export interface StockAge {
  ageDays: number | null; // null: no usable date at all
  from: "purchase_date" | "added_date" | "unknown";
}

interface Measures {
  now: number;
  inStock: number;
  stockCapital: number | null;
  stockPricedCars: number;
  stockUnpricedCars: number;
  stockAges: StockAge[];
  sold: number;
  undatedSales: number;
  soldPerMonth: number;
  avgSalePrice: number | null;
  salePriceCars: number;
  avgPurchasePrice: number | null;
  purchasePriceCars: number;
  avgCost: number | null;
  costCars: number;
  costlessCars: number;
  avgProfit: number | null;
  profitCars: number;
  avgDaysToSell: number | null;
  daysCars: number;
  leads: number;
  leadsWon: number;
  leadsPerMonth: number;
}

function measure(inputs: SimulationInputs): Measures {
  const now = inputs.now;
  if (typeof now !== "number" || Number.isNaN(new Date(now).getTime())) {
    throw new RangeError("The simulator needs a real 'now' (milliseconds since 1970).");
  }
  const book = isRecord(inputs.bookkeeping) ? inputs.bookkeeping : {};
  const purchases = firstByVehicle(list(book.purchases));
  const sales = firstByVehicle(list(book.sales));
  const costsByCar = new Map<string, Record<string, unknown>[]>();
  for (const c of list(book.costs)) {
    if (typeof c.vehicleId !== "string") continue;
    const seen = costsByCar.get(c.vehicleId);
    if (seen) seen.push(c);
    else costsByCar.set(c.vehicleId, [c]);
  }

  // Cars sold in the window. A sale whose date cannot be placed in time is left
  // out (and counted, so it can be reported), exactly as the margins summary does.
  const cutoff = now - WINDOW_DAYS * DAY_MS;
  let undatedSales = 0;
  const salePrices: number[] = [];
  const purchasePrices: number[] = [];
  const costTotals: number[] = [];
  const profits: number[] = [];
  const daysToSell: number[] = [];
  let sold = 0;
  let costless = 0;
  for (const [vehicleId, sale] of sales) {
    const saleMs = notInFuture(dateMs(sale.date), now);
    if (saleMs === null) {
      undatedSales += 1;
      continue;
    }
    if (saleMs < cutoff) continue;
    sold += 1;

    const purchase = purchases.get(vehicleId);
    // A price counts only when it is a real amount above zero (recordedPrice.ts), the
    // same rule as the Bookkeeping hub and vehicleMargins.ts.
    const salePrice = recordedPrice(sale.salePrice);
    const purchasePrice = recordedPrice(purchase?.purchasePrice);
    const amounts = (costsByCar.get(vehicleId) ?? []).map(c => num(c.amount));
    // A cost that is not a real number means the total cannot be trusted.
    const costs = amounts.some(a => a === null) ? null : amounts.reduce<number>((sum, a) => sum + (a ?? 0), 0);

    if (salePrice !== null) salePrices.push(salePrice);
    if (purchasePrice !== null) purchasePrices.push(purchasePrice);
    if (costs !== null) {
      costTotals.push(costs);
      if (amounts.length === 0) costless += 1;
    }
    if (salePrice !== null && purchasePrice !== null && costs !== null) profits.push(salePrice - purchasePrice - costs);

    // Days to sell needs BOTH dates to be real, and the sale not before the purchase.
    const purchaseMs = purchase ? notInFuture(dateMs(purchase.date), now) : null;
    if (purchaseMs !== null && saleMs >= purchaseMs) daysToSell.push(Math.floor((saleMs - purchaseMs) / DAY_MS));
  }

  // Cars in stock: every car not marked sold (as the business summary counts them).
  const stock = list(inputs.vehicles).filter(v => String(v.status ?? "").toLowerCase() !== "sold");
  const stockPrices: number[] = [];
  const stockAges: StockAge[] = [];
  for (const v of stock) {
    const purchase = typeof v.id === "string" ? purchases.get(v.id) : undefined;
    const boughtFor = recordedPrice(purchase?.purchasePrice);
    if (boughtFor !== null) stockPrices.push(boughtFor);

    // Age: from the purchase date if the ledger has a real one, else from the
    // date the car was added to the stock list.
    const boughtMs = purchase ? notInFuture(dateMs(purchase.date), now) : null;
    const addedMs = notInFuture(dateMs(v.createdAt), now);
    const from = boughtMs !== null ? "purchase_date" : addedMs !== null ? "added_date" : "unknown";
    const startMs = boughtMs ?? addedMs;
    stockAges.push({ ageDays: startMs === null ? null : Math.max(0, Math.floor((now - startMs) / DAY_MS)), from });
  }

  // Leads, counted exactly as the lead-source summary counts them.
  const leadCutoff = now - LEAD_WINDOW_DAYS * DAY_MS;
  let leads = 0;
  let leadsWon = 0;
  for (const lead of list(inputs.leads)) {
    const created = notInFuture(dateMs(lead.createdAt), now);
    if (created === null || created < leadCutoff) continue;
    const status = typeof lead.status === "string" ? lead.status.trim().toLowerCase() : "";
    if (status === MOT_BOOKING_STATUS) continue;
    leads += 1;
    if (status === "won") leadsWon += 1;
  }

  return {
    now,
    inStock: stock.length,
    // No cars in stock is a real 0; cars in stock with no known price is UNKNOWN.
    stockCapital: stock.length === 0 ? 0 : stockPrices.length === 0 ? null : stockPrices.reduce((sum, p) => sum + p, 0),
    stockPricedCars: stockPrices.length,
    stockUnpricedCars: stock.length - stockPrices.length,
    stockAges,
    sold,
    undatedSales,
    soldPerMonth: sold / WINDOW_MONTHS,
    avgSalePrice: mean(salePrices),
    salePriceCars: salePrices.length,
    avgPurchasePrice: mean(purchasePrices),
    purchasePriceCars: purchasePrices.length,
    avgCost: mean(costTotals),
    costCars: costTotals.length,
    costlessCars: costless,
    avgProfit: mean(profits),
    profitCars: profits.length,
    avgDaysToSell: mean(daysToSell),
    daysCars: daysToSell.length,
    leads,
    leadsWon,
    leadsPerMonth: leads / LEAD_WINDOW_MONTHS,
  };
}

/* ------------------------------------------------------------------ */
/* The dealership's facts                                               */
/* ------------------------------------------------------------------ */

export interface SimFact extends Figure {
  key: string;
}

export interface SimFacts {
  inStock: SimFact;
  stockCapital: SimFact;
  stockWithoutPurchasePrice: SimFact;
  soldRecently: SimFact;
  soldPerMonth: SimFact;
  avgSalePrice: SimFact;
  avgPurchasePrice: SimFact;
  avgRecordedCost: SimFact;
  avgProfit: SimFact;
  profitKnownCars: SimFact;
  avgDaysToSell: SimFact;
  averageStockAge: SimFact;
  leadsRecently: SimFact;
  leadsWonRecently: SimFact;
  leadsPerMonth: SimFact;
  stockAges: StockAge[];
}

const fact = (key: string, f: Figure): SimFact => ({ key, ...f });

function describeFacts(m: Measures): SimFacts {
  const win = `the last ${WINDOW_DAYS} days`;
  const known = (n: number) => `${carsText(n)} ${plural(n, "has", "have")}`;
  const fromPurchase = m.stockAges.filter(a => a.from === "purchase_date").length;
  const fromAdded = m.stockAges.filter(a => a.from === "added_date").length;
  const noAge = m.stockAges.filter(a => a.from === "unknown").length;
  const ages = present(m.stockAges.map(a => a.ageDays));

  const stockCapitalBasis =
    m.inStock === 0
      ? "You have no cars in stock."
      : m.stockCapital === null
        ? `None of your ${m.inStock} in-stock cars has a purchase price recorded in the Bookkeeping ledger, so this cannot be worked out.`
        : `Purchase prices from the Bookkeeping ledger, added up for the ${carsText(m.stockPricedCars)} in stock that ${plural(m.stockPricedCars, "has", "have")} one recorded.${
            m.stockUnpricedCars > 0
              ? ` ${carsText(m.stockUnpricedCars)} in stock ${plural(m.stockUnpricedCars, "has", "have")} no purchase price recorded, so ${plural(m.stockUnpricedCars, "its cost is", "their costs are")} unknown and left out, not counted as £0.`
              : ""
          }`;

  return {
    inStock: fact("in_stock", figure("Cars in stock", m.inStock, "cars", "known", "Every car in your stock list that is not marked sold.")),
    stockCapital: fact(
      "stock_capital",
      figure("Money tied up in stock", m.stockCapital, "gbp", "known", stockCapitalBasis)
    ),
    stockWithoutPurchasePrice: fact(
      "stock_without_purchase_price",
      figure(
        "In-stock cars with no purchase price recorded",
        m.stockUnpricedCars,
        "cars",
        "known",
        "Counted from the Bookkeeping ledger. What these cars cost is unknown: it is never counted as £0."
      )
    ),
    soldRecently: fact(
      "sold_recently",
      figure(
        `Cars sold in ${win}`,
        m.sold,
        "cars",
        "known",
        `Cars with a sale in the Bookkeeping ledger dated in ${win} (the first sale entry for each car).${
          m.undatedSales > 0 ? ` ${m.undatedSales} ${plural(m.undatedSales, "sale has", "sales have")} no usable date and ${plural(m.undatedSales, "is", "are")} left out.` : ""
        }`
      )
    ),
    soldPerMonth: fact(
      "sold_per_month",
      figure("Cars sold per month", m.soldPerMonth, "cars", "inferred", `${m.sold} sold in ${win}, divided by ${tidy(WINDOW_MONTHS)} months of ${MONTH_DAYS} days.`)
    ),
    avgSalePrice: fact(
      "avg_sale_price",
      figure(
        "Average sale price",
        m.avgSalePrice,
        "gbp",
        "inferred",
        m.avgSalePrice === null
          ? `No car sold in ${LAST_WINDOW} has a sale price recorded.`
          : `Average of the ${carsText(m.salePriceCars)} sold in ${win} with a sale price recorded.`
      )
    ),
    avgPurchasePrice: fact(
      "avg_purchase_price",
      figure(
        "Average purchase price",
        m.avgPurchasePrice,
        "gbp",
        "inferred",
        m.avgPurchasePrice === null
          ? `No car sold in ${LAST_WINDOW} has a purchase price recorded in the ledger.`
          : `Average of the ${carsText(m.purchasePriceCars)} sold in ${win} that ${plural(m.purchasePriceCars, "has", "have")} a purchase price in the ledger.`
      )
    ),
    avgRecordedCost: fact(
      "avg_recorded_cost",
      figure(
        "Average recorded cost per car",
        m.avgCost,
        "gbp",
        "inferred",
        m.avgCost === null
          ? `No car sold in ${LAST_WINDOW} has costs that can be used.`
          : `All costs recorded in the ledger against each of the ${carsText(m.costCars)} sold in ${win}, averaged.${
              m.costlessCars > 0
                ? ` ${carsText(m.costlessCars)} ${plural(m.costlessCars, "has", "have")} no costs recorded at all, so this may be too low if prep or repair costs were never logged.`
                : ""
            }`
      )
    ),
    avgProfit: fact(
      "avg_profit",
      figure(
        "Average profit per car",
        m.avgProfit,
        "gbp",
        "inferred",
        m.avgProfit === null
          ? `No car sold in ${LAST_WINDOW} has a sale price, a purchase price and usable costs all recorded, so profit per car is unknown.`
          : `Sale price - purchase price - recorded costs (no VAT adjustment, as on the Bookkeeping screen), averaged over the ${carsText(m.profitCars)} where all three are known.${
              m.sold > m.profitCars
                ? ` The other ${carsText(m.sold - m.profitCars)} sold in ${win} ${plural(m.sold - m.profitCars, "is", "are")} left out, not counted as £0.`
                : ""
            }`
      )
    ),
    profitKnownCars: fact(
      "profit_known_cars",
      figure(
        "Sold cars with a known profit",
        m.profitCars,
        "cars",
        "known",
        `Of ${carsText(m.sold)} sold in ${win}, ${known(m.profitCars)} a sale price, a purchase price and usable costs all recorded.`
      )
    ),
    avgDaysToSell: fact(
      "avg_days_to_sell",
      figure(
        "Average days to sell",
        m.avgDaysToSell,
        "days",
        "inferred",
        m.avgDaysToSell === null
          ? `No car sold in ${LAST_WINDOW} has both a purchase date and a sale date that can be used.`
          : `Purchase date to sale date, averaged over the ${carsText(m.daysCars)} sold in ${win} with both dates usable. Cars missing a date are left out.`
      )
    ),
    averageStockAge: fact(
      "average_stock_age",
      figure(
        "Average age of cars in stock",
        mean(ages),
        "days",
        "inferred",
        `Age is counted from the purchase date where the ledger has one (${carsText(fromPurchase)}), and from the date the car was added otherwise (${carsText(fromAdded)}).${
          noAge > 0 ? ` ${carsText(noAge)} ${plural(noAge, "has", "have")} no usable date and ${plural(noAge, "is", "are")} not aged.` : ""
        }`
      )
    ),
    leadsRecently: fact(
      "leads_recently",
      figure(
        `Enquiries in the last ${LEAD_WINDOW_DAYS} days`,
        m.leads,
        "count",
        "known",
        "Leads created in that time, not counting website MOT bookings (the customer's own car, so never a sale)."
      )
    ),
    leadsWonRecently: fact(
      "leads_won_recently",
      figure(`Enquiries won in the last ${LEAD_WINDOW_DAYS} days`, m.leadsWon, "count", "known", "Leads created in that time and marked won.")
    ),
    leadsPerMonth: fact(
      "leads_per_month",
      figure("Enquiries per month", m.leadsPerMonth, "count", "inferred", `${m.leads} enquiries in ${LEAD_WINDOW_DAYS} days, divided by ${tidy(LEAD_WINDOW_MONTHS)} months of ${MONTH_DAYS} days.`)
    ),
    stockAges: m.stockAges.map(a => ({ ...a })),
  };
}

// What the dealership's own records say, each fact with its kind and basis.
export function extractFacts(inputs: SimulationInputs): SimFacts {
  return describeFacts(measure(inputs));
}

/* ------------------------------------------------------------------ */
/* Confidence, decided here in code                                     */
/* ------------------------------------------------------------------ */

function assess(m: Measures): { level: Confidence; reasons: string[] } {
  const reasons: string[] = [];
  let low = false;

  if (m.sold < MIN_SALES_FOR_CONFIDENCE) {
    low = true;
    reasons.push(
      m.sold === 0
        ? `No car was sold in the last ${WINDOW_DAYS} days, so there is no recent pace to work from.`
        : `Only ${carsText(m.sold)} sold in the last ${WINDOW_DAYS} days. At least ${MIN_SALES_FOR_CONFIDENCE} are needed before the recent pace means much.`
    );
  } else {
    reasons.push(`${carsText(m.sold)} sold in the last ${WINDOW_DAYS} days (at least ${MIN_SALES_FOR_CONFIDENCE} are needed).`);
  }

  if (m.profitCars < MIN_KNOWN_PROFITS_FOR_CONFIDENCE) {
    low = true;
    reasons.push(
      m.profitCars === 0
        ? `Profit is not known for any car sold recently. At least ${MIN_KNOWN_PROFITS_FOR_CONFIDENCE} are needed for a fair average.`
        : `Profit is known for only ${carsText(m.profitCars)} of those sold. At least ${MIN_KNOWN_PROFITS_FOR_CONFIDENCE} are needed for a fair average.`
    );
  } else {
    reasons.push(`Profit is known for ${carsText(m.profitCars)} of those sold (at least ${MIN_KNOWN_PROFITS_FOR_CONFIDENCE} are needed).`);
  }

  // An average of £0 cannot be divided by either, so it counts as unknown here too.
  if (m.avgPurchasePrice === null || m.avgPurchasePrice <= 0) {
    low = true;
    reasons.push(
      m.avgPurchasePrice === null
        ? "The average price paid for a car is unknown, because no car sold recently has a purchase price recorded."
        : "The average price paid for a car works out at £0 or less, so it cannot be used."
    );
  }

  reasons.push(
    "This is straight-line arithmetic on recent history, which does not earn HIGH confidence in this version. MEDIUM is the most it can be."
  );

  // parseConfidence is the one gate: only the three words can ever get out.
  return { level: parseConfidence(low ? "low" : "medium") ?? "low", reasons };
}

function finish(
  kind: SimulationKind,
  title: string,
  m: Measures,
  assumptions: SimAssumption[],
  scenarios: SimScenario[]
): SimulationPreview {
  const { level, reasons } = assess(m);
  return {
    ranAt: new Date(m.now).toISOString(),
    kind,
    title,
    assumptions,
    scenarios,
    confidence: level,
    confidenceReasons: reasons,
    note: SIMULATION_NOTE,
  };
}

/* ------------------------------------------------------------------ */
/* Scenario: put more money into stock                                  */
/* ------------------------------------------------------------------ */

export interface StockInvestmentParams {
  amountGbp: number;
}

// Why an unknown figure is unknown, in plain words.
const NO_PRICE_PAID = `The average price paid for a car is unknown, because no car sold in ${LAST_WINDOW} has a purchase price recorded.`;
const NO_PROFIT = `The average profit per car is unknown, because no car sold in ${LAST_WINDOW} has a complete profit figure.`;

function stockInvestment(m: Measures, params: StockInvestmentParams): SimulationPreview {
  const amount = params.amountGbp;
  const slower = 1 + SLOWER_SELL_PERCENT / 100;
  const price = m.avgPurchasePrice;
  const profit = m.avgProfit;

  const extraCars = price !== null && price > 0 ? amount / price : null;
  // Stock is the constraint: every car in stock sells at today's average pace.
  const salesPerCar = m.inStock > 0 ? m.soldPerMonth / m.inStock : null;
  const extraSales = extraCars !== null && salesPerCar !== null ? extraCars * salesPerCar : null;
  const extraProfit = extraSales !== null && profit !== null ? extraSales * profit : null;
  const payback = extraProfit !== null && extraProfit > 0 ? amount / extraProfit : null;
  const slowSales = extraSales !== null ? extraSales / slower : null;
  const slowProfit = extraProfit !== null ? extraProfit / slower : null;
  const slowPayback = slowProfit !== null && slowProfit > 0 ? amount / slowProfit : null;
  const slowDays = m.avgDaysToSell !== null ? m.avgDaysToSell * slower : null;
  const keepProfit = profit !== null ? m.soldPerMonth * profit : null;

  const carsBasis =
    extraCars !== null
      ? `${pounds(amount)} divided by the average price paid for a car (${pounds(price ?? 0)}).`
      : price === null
        ? `${NO_PRICE_PAID} So the number of extra cars cannot be worked out.`
        : "The average price paid for a car works out at £0 or less, so the number of extra cars cannot be worked out.";
  const salesBasis =
    extraSales !== null
      ? `Sales rise in step with stock: ${tidy(extraCars ?? 0)} extra cars at today's pace of ${tidy(m.soldPerMonth)} sales a month across ${carsText(m.inStock)} in stock. A prediction, not a record.`
      : extraCars === null
        ? "Needs the number of extra cars, which is unknown."
        : "You have no cars in stock now, so there is no sales-per-car pace to scale from.";
  const profitBasis =
    extraProfit !== null
      ? `Extra cars sold per month times the average profit per car (${pounds(profit ?? 0)}). A prediction, not a record.`
      : extraSales === null
        ? "Needs the extra sales, which are unknown."
        : NO_PROFIT;
  const paybackBasis =
    payback !== null
      ? `Extra money (${pounds(amount)}) divided by the extra profit per month. A prediction, not a record.`
      : extraProfit === null
        ? "Needs the extra profit, which is unknown."
        : "Not earned back: at these figures the extra cars add no profit, so the extra money is never returned.";

  const notModelled = (): Figure[] => [
    figure("Cost of the money", null, "gbp", "unknown", "Not modelled: there is no record of your cash, borrowing or finance costs, so none is guessed."),
    figure("Extra preparation work", null, "days", "unknown", "Not modelled: there is no record of workshop time or capacity, so the extra valeting, repairs and MOTs are not counted."),
    figure(
      "Extra selling capacity",
      null,
      "cars",
      "unknown",
      `Not modelled: the records do not show how many more cars your team could sell. For context, ${m.leads} ${plural(m.leads, "enquiry", "enquiries")} came in over the last ${LEAD_WINDOW_DAYS} days.`
    )
  ];

  const moneyRow = () => figure("Extra money put into stock", amount, "gbp", "known", "The amount you entered.");
  const carsRow = () => figure("Extra cars bought", extraCars, "cars", extraCars === null ? "unknown" : "inferred", carsBasis);

  const keep: SimScenario = {
    key: "keep",
    label: "Keep things as they are",
    figures: [
      figure("Cars sold per month now", m.soldPerMonth, "cars", "inferred", `${m.sold} sold in the last ${WINDOW_DAYS} days, divided by ${tidy(WINDOW_MONTHS)} months of ${MONTH_DAYS} days.`),
      figure(
        "Profit per month now",
        keepProfit,
        "gbp",
        keepProfit === null ? "unknown" : "inferred",
        keepProfit === null ? NO_PROFIT : `Cars sold per month times the average profit per car (${pounds(profit ?? 0)}).`
      ),
    ],
  };

  const flat: SimScenario = {
    key: "add_sales_flat",
    label: "Add stock, sales do not rise",
    figures: [
      moneyRow(),
      carsRow(),
      figure("Extra cars sold per month", 0, "cars", "predicted", "Assumes stock is not what holds your sales back, so more cars on the forecourt make no more sales."),
      figure("Extra profit per month", 0, "gbp", "predicted", "If sales do not rise, the extra money earns nothing: the extra cars just sit in stock."),
      figure("Months to earn the extra money back", null, "months", "unknown", "Not earned back: with no extra sales there is no extra profit, so the extra money is never returned."),
      ...notModelled(),
    ],
  };

  const rise: SimScenario = {
    key: "add_sales_rise",
    label: "Add stock, sales rise in proportion",
    figures: [
      moneyRow(),
      carsRow(),
      figure("Extra cars sold per month", extraSales, "cars", extraSales === null ? "unknown" : "predicted", salesBasis),
      figure("Extra profit per month", extraProfit, "gbp", extraProfit === null ? "unknown" : "predicted", profitBasis),
      figure("Months to earn the extra money back", payback, "months", payback === null ? "unknown" : "predicted", paybackBasis),
      figure(
        "Slower case: extra cars sold per month",
        slowSales,
        "cars",
        slowSales === null ? "unknown" : "predicted",
        slowSales === null ? salesBasis : `Downside: if cars take ${SLOWER_SELL_PERCENT}% longer to sell than they do now, the extra cars sell ${SLOWER_SELL_PERCENT}% more slowly. A prediction, not a record.`
      ),
      figure(
        "Slower case: extra profit per month",
        slowProfit,
        "gbp",
        slowProfit === null ? "unknown" : "predicted",
        slowProfit === null ? profitBasis : "Downside: the slower extra sales, times the average profit per car. A prediction, not a record."
      ),
      figure(
        "Slower case: months to earn the extra money back",
        slowPayback,
        "months",
        slowPayback === null ? "unknown" : "predicted",
        slowPayback === null ? paybackBasis : "Downside: the extra money divided by the slower extra profit per month. A prediction, not a record."
      ),
      figure(
        "Slower case: average days to sell",
        slowDays,
        "days",
        slowDays === null ? "unknown" : "predicted",
        slowDays === null
          ? `No car sold in ${LAST_WINDOW} has both a purchase date and a sale date that can be used.`
          : `Today's average (${tidy(m.avgDaysToSell ?? 0)} days) made ${SLOWER_SELL_PERCENT}% longer. A prediction, not a record.`
      ),
      ...notModelled(),
    ],
  };

  const assumptions: SimAssumption[] = [
    assumption("amount", "Money you would put into stock", amount, "gbp", "boss", "known"),
    assumption("avg_purchase_price", "Average price paid for a car (cars sold in " + LAST_WINDOW + ")", price, "gbp", "history", "inferred"),
    assumption("stock_now", "Cars in stock now", m.inStock, "cars", "history", "known"),
    assumption("sold_per_month", "Cars sold per month (" + LAST_WINDOW + ")", m.soldPerMonth, "cars", "history", "inferred"),
    assumption("avg_profit", "Average profit per car sold (" + LAST_WINDOW + ")", profit, "gbp", "history", "inferred"),
    assumption("avg_days_to_sell", "Average days to sell a car (" + LAST_WINDOW + ")", m.avgDaysToSell, "days", "history", "inferred"),
    assumption("sales_flat", "First extra scenario: how sales react to more stock", "They do not: sales stay at today's pace", "text", "default", "predicted"),
    assumption("sales_rise", "Second extra scenario: how sales react to more stock", "They rise in step with the number of cars in stock", "text", "default", "predicted"),
    assumption("slower_sell_percent", "Slower case: cars take this much longer to sell", SLOWER_SELL_PERCENT, "percent", "default", "predicted"),
  ];

  return finish("stock_investment", `Put ${pounds(amount)} into stock`, m, assumptions, [keep, flat, rise]);
}

/* ------------------------------------------------------------------ */
/* Scenario: cut the price of aged stock                                */
/* ------------------------------------------------------------------ */

export interface PriceCutParams {
  daysThreshold?: number;
  cutGbp?: number;
  // Boss's own guess at how many extra cars the cut sells. Never invented here.
  extraSalesFromCut?: number;
}

function priceCut(m: Measures, params: PriceCutParams): SimulationPreview {
  const days = params.daysThreshold ?? SIM_DEFAULT_DAYS;
  const cut = params.cutGbp ?? SIM_DEFAULT_CUT;
  const guess = params.extraSalesFromCut;
  const profit = m.avgProfit;

  const aged = m.stockAges.filter(a => a.ageDays !== null && a.ageDays >= days);
  const agedCount = aged.length;
  const agedFromPurchase = aged.filter(a => a.from === "purchase_date").length;
  const noAge = m.stockAges.filter(a => a.from === "unknown").length;
  const givenUp = agedCount * cut;
  const after = profit !== null ? profit - cut : null;

  // The cut pays for itself when the extra cars it sells (cars that would NOT
  // otherwise sell), each making the profit left after the cut, cover what the
  // cut gives away on the aged cars that would have sold anyway.
  let breakeven: number | null;
  let breakevenBasis: string;
  if (givenUp === 0) {
    breakeven = 0;
    breakevenBasis = "The cut gives nothing away, so no extra sales are needed.";
  } else if (after === null) {
    breakeven = null;
    breakevenBasis = `${NO_PROFIT} So the break-even cannot be worked out.`;
  } else if (after <= 0) {
    breakeven = null;
    breakevenBasis = `Not achievable at this cut: after a ${pounds(cut)} cut the average car makes ${pounds(after)}, so no number of extra sales could pay for it.`;
  } else {
    breakeven = givenUp / after;
    breakevenBasis = `What the cut gives up (${pounds(givenUp)}) divided by the profit left on each extra car (${pounds(after)}). Extra cars that would not otherwise sell.`;
  }

  const extraProfit = guess !== undefined && after !== null ? guess * after : null;
  const net = extraProfit !== null ? extraProfit - givenUp : null;

  const agedBasis = `${carsText(agedCount)} of ${carsText(m.inStock)} in stock ${plural(agedCount, "has", "have")} been there ${days} days or more. Age is counted from the purchase date where the ledger has one (${agedFromPurchase} of those), otherwise from the date the car was added.${
    noAge > 0 ? ` ${carsText(noAge)} ${plural(noAge, "has", "have")} no usable date and ${plural(noAge, "is", "are")} not counted.` : ""
  }`;

  const keep: SimScenario = {
    key: "keep",
    label: "Keep the prices",
    figures: [
      figure("Aged cars in stock", agedCount, "cars", "known", agedBasis),
      figure("Margin given up", 0, "gbp", "known", "Nothing is cut."),
      figure(
        "Average profit per car",
        profit,
        "gbp",
        profit === null ? "unknown" : "inferred",
        profit === null ? NO_PROFIT : `If a car sells at today's price, about this much on average (cars sold in the last ${WINDOW_DAYS} days with a known profit).`
      ),
    ],
  };

  const cutFigures: Figure[] = [
    figure("Aged cars in stock", agedCount, "cars", "known", agedBasis),
    figure("Margin given up", givenUp, "gbp", "known", `${carsText(agedCount)} times the ${pounds(cut)} cut: the most it gives away, if all of them sell after the cut.`),
    figure(
      "Average profit per car",
      after,
      "gbp",
      after === null ? "unknown" : "inferred",
      after === null ? NO_PROFIT : `Average profit today (${pounds(profit ?? 0)}) less the ${pounds(cut)} cut.`
    ),
    figure("Extra cars needed to pay for the cut", breakeven, "cars", breakeven === null ? "unknown" : "inferred", breakevenBasis),
    figure(
      "Extra cars the cut would sell",
      guess ?? null,
      "cars",
      guess === undefined ? "unknown" : "predicted",
      guess === undefined
        ? "Not predicted: nothing in your records shows how many extra cars a price cut sells. Enter your own guess to test it."
        : "Your own guess (boss). A prediction, not a record."
    ),
  ];
  if (guess !== undefined) {
    cutFigures.push(
      figure(
        "Profit from those extra cars",
        extraProfit,
        "gbp",
        extraProfit === null ? "unknown" : "predicted",
        extraProfit === null ? NO_PROFIT : `Your guess (${tidy(guess)} cars) times the profit left on each after the cut (${pounds(after ?? 0)}). A prediction, not a record.`
      ),
      figure(
        "Net result of the cut",
        net,
        "gbp",
        net === null ? "unknown" : "predicted",
        net === null ? NO_PROFIT : `Profit from the extra cars less the margin given up (${pounds(givenUp)}). Above zero, the cut pays for itself at your guess. A prediction, not a record.`
      )
    );
  }
  const cutScenario: SimScenario = { key: "cut", label: `Cut ${pounds(cut)} off each aged car`, figures: cutFigures };

  const assumptions: SimAssumption[] = [
    assumption("days_threshold", "A car counts as aged after this many days in stock", days, "days", params.daysThreshold !== undefined ? "boss" : "default", "known"),
    assumption("cut", "Price cut on each aged car", cut, "gbp", params.cutGbp !== undefined ? "boss" : "default", "known"),
    assumption("avg_profit", "Average profit per car sold (" + LAST_WINDOW + ")", profit, "gbp", "history", "inferred"),
    guess !== undefined
      ? assumption("extra_sales_from_cut", "Extra cars the cut sells that would not sell anyway", guess, "cars", "boss", "predicted")
      : assumption("extra_sales_from_cut", "Extra cars the cut sells that would not sell anyway (not known)", null, "cars", "default", "unknown"),
    assumption("all_aged_sell", "Margin given up counts every aged car as selling at the cut price", "Yes", "text", "default", "predicted"),
  ];

  return finish("price_cut_aged_stock", `Cut ${pounds(cut)} off cars in stock ${days} days or more`, m, assumptions, [keep, cutScenario]);
}

/* ------------------------------------------------------------------ */
/* Checking what Boss asked for, and running it                         */
/* ------------------------------------------------------------------ */

export type SimulationRequest =
  | { kind: "stock_investment"; params: StockInvestmentParams }
  | { kind: "price_cut_aged_stock"; params: PriceCutParams };

export type ParsedRequest = { ok: true; request: SimulationRequest } | { ok: false; error: string };

const refuse = (error: string): ParsedRequest => ({ ok: false, error });
const inRange = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;

// Strict on purpose: only real, finite numbers inside the limits, in a request
// the caller sent. Nothing typed anywhere is ever passed through as it came.
export function parseSimulationRequest(body: unknown): ParsedRequest {
  if (!isRecord(body) || body.kind === undefined) return refuse("Choose a simulation and give its numbers.");
  const kind = body.kind;
  if (kind !== "stock_investment" && kind !== "price_cut_aged_stock") {
    return refuse('That simulation is not available. Choose "stock_investment" or "price_cut_aged_stock".');
  }
  const raw = body.params === undefined ? {} : body.params;
  if (!isRecord(raw)) return refuse("The numbers for the simulation must be sent as an object.");

  if (kind === "stock_investment") {
    const amountGbp = inRange(raw.amountGbp, SIM_AMOUNT_MIN, SIM_AMOUNT_MAX);
    if (amountGbp === null) {
      return refuse(`How much would you put into stock? Enter an amount from £${SIM_AMOUNT_MIN} to £${SIM_AMOUNT_MAX.toLocaleString("en-GB")}.`);
    }
    return { ok: true, request: { kind, params: { amountGbp } } };
  }

  const params: PriceCutParams = {};
  if (raw.daysThreshold !== undefined) {
    const daysThreshold = inRange(raw.daysThreshold, SIM_DAYS_MIN, SIM_DAYS_MAX);
    if (daysThreshold === null) return refuse(`Days in stock must be a number from ${SIM_DAYS_MIN} to ${SIM_DAYS_MAX}.`);
    params.daysThreshold = daysThreshold;
  }
  if (raw.cutGbp !== undefined) {
    const cutGbp = inRange(raw.cutGbp, SIM_CUT_MIN, SIM_CUT_MAX);
    if (cutGbp === null) return refuse(`The price cut must be a number from £${SIM_CUT_MIN} to £${SIM_CUT_MAX.toLocaleString("en-GB")}.`);
    params.cutGbp = cutGbp;
  }
  if (raw.extraSalesFromCut !== undefined) {
    const extraSalesFromCut = inRange(raw.extraSalesFromCut, SIM_EXTRA_SALES_MIN, SIM_EXTRA_SALES_MAX);
    if (extraSalesFromCut === null) {
      return refuse(`Extra cars sold by the cut must be a number from ${SIM_EXTRA_SALES_MIN} to ${SIM_EXTRA_SALES_MAX}.`);
    }
    params.extraSalesFromCut = extraSalesFromCut;
  }
  return { ok: true, request: { kind, params } };
}

// Run one simulation. Reads the records it is given, returns a result, changes nothing.
export function runSimulation(inputs: SimulationInputs, request: SimulationRequest): SimulationPreview {
  const m = measure(inputs);
  return request.kind === "stock_investment" ? stockInvestment(m, request.params) : priceCut(m, request.params);
}
