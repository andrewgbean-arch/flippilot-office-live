import { calculateMarginVat, calculateVat } from "@/bookkeeping/vatUtils";

// The arithmetic behind the Profit Breakdown screen, kept out of the
// component so it can be tested.
//
// This used to take 1/6 of (sale price minus ALL costs) and call it
// "VAT on margin". That is not the UK VAT Margin Scheme: HMRC charges the
// VAT on sale price minus PURCHASE price only, and reconditioning, parts and
// other costs do not reduce it. The app's own bookkeeping (vatUtils.ts) has
// always done it correctly, so this file now calls the same
// calculateMarginVat() instead of holding a second copy of the formula.
// Worked example the old screen got wrong: buy 5,000, recon 1,000, sell
// 7,000. VAT is 1/6 of 2,000 = 333.33, not 1/6 of 1,000 = 166.67.

/** The standard UK VAT rate, as a decimal fraction (0.2 = 20%). */
export const PROFIT_VAT_RATE = 0.2;

/**
 * margin   - VAT Margin Scheme: VAT only on (sale - purchase).
 * standard - ordinary VAT: the sale price is treated as VAT-inclusive.
 * none     - not VAT-registered, or no VAT to take off.
 */
export type ProfitVatTreatment = "margin" | "standard" | "none";

export type AmountInput = number | string | null | undefined;

export interface ProfitBreakdownInput {
  purchasePrice: AmountInput;
  reconCost: AmountInput;
  partsLabour: AmountInput;
  otherCosts: AmountInput;
  salePrice: AmountInput;
  treatment: ProfitVatTreatment;
}

export interface ProfitBreakdownResult {
  /** True once both a purchase price and a sale price have been entered. */
  ready: boolean;
  /** Purchase + recon + parts and labour + other costs. Blank costs count as 0. */
  totalCosts: number;
  /** Sale price minus every cost, before VAT. Null until ready. */
  grossProfit: number | null;
  /** The figure the VAT is charged on: sale - purchase (margin) or the sale price (standard). */
  vatBasis: number | null;
  /** VAT due on the sale. Null until ready. */
  vat: number | null;
  /** Gross profit minus the VAT due. Null until ready. */
  netProfit: number | null;
  /** Gross profit as a percentage of the sale price. Null until ready, or when the sale price is 0. */
  marginPct: number | null;
}

/**
 * Turns whatever the form holds into a usable amount. Blank, non-numeric,
 * negative and non-finite entries are "missing" (null): a blank field is not
 * the same thing as an entered 0.
 */
export function toAmount(raw: AmountInput): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function calculateProfitBreakdown(input: ProfitBreakdownInput): ProfitBreakdownResult {
  const purchase = toAmount(input.purchasePrice);
  const sale = toAmount(input.salePrice);
  // Optional costs: blank simply means none.
  const recon = toAmount(input.reconCost) ?? 0;
  const parts = toAmount(input.partsLabour) ?? 0;
  const other = toAmount(input.otherCosts) ?? 0;

  const totalCosts = (purchase ?? 0) + recon + parts + other;

  // Without a purchase price AND a sale price there is no honest profit or
  // VAT figure: a missing purchase price would otherwise read as "the car
  // cost nothing" and the whole sale price would look like margin.
  if (purchase === null || sale === null) {
    return { ready: false, totalCosts, grossProfit: null, vatBasis: null, vat: null, netProfit: null, marginPct: null };
  }

  const grossProfit = sale - totalCosts;

  let vat = 0;
  let vatBasis = 0;
  if (input.treatment === "margin") {
    const margin = calculateMarginVat(sale, purchase, PROFIT_VAT_RATE);
    vat = margin.vat;
    vatBasis = margin.margin;
  } else if (input.treatment === "standard") {
    const breakdown = calculateVat(sale, { vatRate: PROFIT_VAT_RATE, vatIncluded: true, vatReclaimable: false });
    vat = breakdown.vat;
    vatBasis = sale;
  }

  return {
    ready: true,
    totalCosts,
    grossProfit,
    vatBasis,
    vat,
    netProfit: grossProfit - vat,
    marginPct: sale > 0 ? (grossProfit / sale) * 100 : null,
  };
}

/** "£1,234.50" or "-£1,234.50". */
export function formatMoney(value: number): string {
  const pence = Math.round(value * 100);
  // A value that rounds to nothing must not print as "-£0.00".
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(pence) / 100;
  return `${sign}£${abs.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
