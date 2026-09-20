import { toAmount, type AmountInput } from "./money";

// The sums behind the Finance Calculator, Deal Sheet, Lender Comparison and
// Trade-In screens, kept out of the components so they can be tested.
//
// What the old screens got wrong, so nobody reintroduces it:
//  - a 9.9% APR was pre-filled in the calculator and the deal sheet, and three
//    invented lenders (9.9, 12.5, 7.4) with a "Best Rate" badge in the
//    comparison, so a customer-facing page carried a rate nobody had quoted;
//  - the calculator showed 0.00 a month at 0% APR (0 / 0 became NaN, then 0);
//    the right answer is the amount divided by the number of months;
//  - "APR" was divided by 12 as if it were a nominal rate. An APR is an
//    effective annual rate, so the monthly rate is (1 + APR)^(1/12) - 1;
//  - nothing said the figures were illustrative.

export const FINANCE_DISCLAIMER =
  "Illustrative only. This is not a finance quote or a credit offer. Finance is subject to status, and the lender's agreement sets the actual APR, payments and total payable.";

export const FINANCE_METHOD_NOTE =
  "Worked out as equal monthly payments in arrears at the APR you enter, with no fees. Real payments depend on the lender's agreement.";

/** Monthly rate for an APR, which is an effective annual rate: (1 + APR)^(1/12) - 1. */
export function monthlyRateFromApr(aprPercent: number): number {
  return Math.pow(1 + aprPercent / 100, 1 / 12) - 1;
}

/**
 * Equal monthly payments in arrears that clear `principal` over `months` at an
 * APR of `aprPercent`. At 0% it is simply principal / months.
 */
export function loanPayment(principal: number, months: number, aprPercent: number): number {
  if (aprPercent === 0) return principal / months;
  const r = monthlyRateFromApr(aprPercent);
  const payment = (principal * r) / (1 - Math.pow(1 + r, -months));
  // A rate so small that (1 + r) rounds to 1 is, for this purpose, 0%.
  return Number.isFinite(payment) ? payment : principal / months;
}

export type LoanStatus = "incomplete" | "invalid" | "no-balance" | "ok";

export interface LoanResult {
  status: LoanStatus;
  /** Plain sentence for the dealer when the status is not "ok". */
  message: string | null;
  monthlyPayment: number | null;
  totalRepayable: number | null;
  totalInterest: number | null;
}

function notOk(status: Exclude<LoanStatus, "ok">, message: string): LoanResult {
  return { status, message, monthlyPayment: null, totalRepayable: null, totalInterest: null };
}

const isBlank = (raw: AmountInput) => raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "");

/**
 * `amount` is the sum to finance, already worked out by the caller (null while
 * it cannot be). `months` and `apr` are what the dealer typed: a blank is
 * "not entered yet", and 0% APR is a real entry.
 */
export function calculateLoan(amount: number | null, months: AmountInput, apr: AmountInput): LoanResult {
  if (amount === null) return notOk("incomplete", "Enter the amount to finance.");
  if (isBlank(months)) return notOk("incomplete", "Enter the term in months.");
  if (isBlank(apr)) return notOk("incomplete", "Enter an APR. 0 is allowed for a 0% offer.");

  const term = toAmount(months);
  if (term === null || !Number.isInteger(term) || term < 1) {
    return notOk("invalid", "The term must be a whole number of months, 1 or more.");
  }
  const rate = toAmount(apr);
  if (rate === null) return notOk("invalid", "The APR must be 0 or more.");

  if (amount <= 0) return notOk("no-balance", "There is nothing to finance.");

  const monthlyPayment = loanPayment(amount, term, rate);
  const totalRepayable = monthlyPayment * term;
  return {
    status: "ok",
    message: null,
    monthlyPayment,
    totalRepayable,
    totalInterest: Math.max(0, totalRepayable - amount),
  };
}

// --- Calculator: price minus deposit -------------------------------------------

/** Amount to finance from a price and a deposit. Null until a price is entered. A blank deposit is none. */
export function amountToFinance(price: AmountInput, deposit: AmountInput): number | null {
  const p = toAmount(price);
  if (p === null) return null;
  return p - (toAmount(deposit) ?? 0);
}

// --- Deal sheet ------------------------------------------------------------------

export interface DealSheetInput {
  salePrice: AmountInput;
  tradeInValue: AmountInput;
  deposit: AmountInput;
  months: AmountInput;
  apr: AmountInput;
}

export interface DealSheetFigures {
  salePrice: number | null;
  tradeInValue: number;
  deposit: number;
  /** Sale price minus trade-in and deposit. Null until a sale price is entered. */
  balanceToFinance: number | null;
  /** Trade-in plus deposit beyond the sale price (nothing left to finance), else 0. */
  surplus: number;
  loan: LoanResult;
  /** Everything the customer pays over the deal, including the deposit and the trade-in: sale price plus interest. */
  totalPayable: number | null;
}

export function dealSheetFigures(input: DealSheetInput): DealSheetFigures {
  const salePrice = toAmount(input.salePrice);
  const tradeInValue = toAmount(input.tradeInValue) ?? 0;
  const deposit = toAmount(input.deposit) ?? 0;

  const balanceToFinance = salePrice === null ? null : salePrice - tradeInValue - deposit;
  const surplus = balanceToFinance !== null && balanceToFinance < 0 ? -balanceToFinance : 0;
  const loan = calculateLoan(balanceToFinance, input.months, input.apr);

  let totalPayable: number | null = null;
  if (salePrice !== null) {
    if (loan.status === "ok") totalPayable = salePrice + (loan.totalInterest ?? 0);
    else if (loan.status === "no-balance") totalPayable = salePrice;
  }

  return { salePrice, tradeInValue, deposit, balanceToFinance, surplus, loan, totalPayable };
}

// --- Lender comparison -----------------------------------------------------------

export interface LenderRowInput {
  id: string;
  name: string;
  apr: string;
}

export interface LenderRow {
  id: string;
  name: string;
  loan: LoanResult;
  /** Lowest monthly payment of the lenders compared, and not every lender is the same. */
  isLowest: boolean;
}

/**
 * Compares the lenders the dealer has typed in. A "lowest payment" mark is only
 * given when at least two lenders have a usable APR and their payments differ:
 * with one lender, or all the same, nothing is being compared.
 */
export function compareLenders(amount: AmountInput, months: AmountInput, lenders: LenderRowInput[]): LenderRow[] {
  const principal = toAmount(amount);
  const rows: LenderRow[] = lenders.map((l) => ({
    id: l.id,
    name: l.name,
    loan: calculateLoan(principal, months, l.apr),
    isLowest: false,
  }));

  const pence = rows
    .filter((r) => r.loan.status === "ok")
    .map((r) => ({ id: r.id, p: Math.round((r.loan.monthlyPayment as number) * 100) }));
  if (pence.length >= 2) {
    const min = Math.min(...pence.map((x) => x.p));
    const max = Math.max(...pence.map((x) => x.p));
    if (max > min) {
      const lowestIds = new Set(pence.filter((x) => x.p === min).map((x) => x.id));
      for (const r of rows) r.isLowest = lowestIds.has(r.id);
    }
  }
  return rows;
}

// --- Trade-in ---------------------------------------------------------------------

export type TradeInCondition = "excellent" | "good" | "fair" | "poor";

/**
 * A rule of thumb, shown to the dealer and editable on screen: the percentage
 * taken off the market value for each condition. It used to be applied
 * silently. The dealer's own view of the car always wins.
 */
export const CONDITION_ALLOWANCE_DEFAULT_PCT: Record<TradeInCondition, number> = {
  excellent: 0,
  good: 5,
  fair: 12,
  poor: 22,
};

/** The dealer's margin taken off before an offer, as a starting point the dealer can change. */
export const DEFAULT_TRADE_IN_MARGIN_PCT = 10;

export interface TradeInInput {
  marketValue: AmountInput;
  allowancePct: AmountInput;
  marginPct: AmountInput;
  outstandingFinance: AmountInput;
}

export interface TradeInFigures {
  ready: boolean;
  marketValue: number | null;
  allowance: number;
  adjustedValue: number | null;
  margin: number;
  /** Adjusted value less the dealer's margin: what the car is worth to the dealer in trade. */
  offerBeforeFinance: number | null;
  outstandingFinance: number;
  /** Offer less finance still owed, when positive: what the customer is paid. */
  paidToCustomer: number | null;
  /** Finance still owed beyond the offer, when there is a shortfall. */
  shortfall: number;
}

const clampPct = (raw: AmountInput): number => {
  const n = toAmount(raw);
  if (n === null) return 0;
  return Math.min(100, n);
};

export function tradeInFigures(input: TradeInInput): TradeInFigures {
  const marketValue = toAmount(input.marketValue);
  const outstandingFinance = toAmount(input.outstandingFinance) ?? 0;

  if (marketValue === null) {
    return {
      ready: false, marketValue: null, allowance: 0, adjustedValue: null, margin: 0,
      offerBeforeFinance: null, outstandingFinance, paidToCustomer: null, shortfall: 0,
    };
  }

  const allowance = marketValue * (clampPct(input.allowancePct) / 100);
  const adjustedValue = marketValue - allowance;
  const margin = adjustedValue * (clampPct(input.marginPct) / 100);
  const offerBeforeFinance = adjustedValue - margin;
  const net = offerBeforeFinance - outstandingFinance;

  return {
    ready: true,
    marketValue,
    allowance,
    adjustedValue,
    margin,
    offerBeforeFinance,
    outstandingFinance,
    paidToCustomer: net >= 0 ? net : 0,
    shortfall: net < 0 ? -net : 0,
  };
}
