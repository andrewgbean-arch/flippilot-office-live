import { randomUUID } from "crypto";
import { readTenantDoc, writeTenantDoc } from "./db";

/**
 * The £30/month usage credit that pays for Pilot Brain's two real-cost
 * extras — a live web lookup and a spoken (voice) reply. Text chat itself
 * is covered by the subscription price and is never metered here (see
 * pilotBrainTaster.ts for what a TRIAL dealership gets of that instead).
 *
 * Kept in PENCE so nothing is ever a fraction of a penny. The rate card
 * below is an ESTIMATE (never checked against a real invoice yet — see the
 * launch roadmap): 5p for a web lookup, 15p for a spoken reply. Adjust the
 * two numbers here once a real-key cost measurement exists; nothing else
 * needs to change.
 */
export const RATE_CARD_PENCE = {
  webLookup: 5,
  voiceReply: 15,
} as const;

export type CreditSpendKind = keyof typeof RATE_CARD_PENCE;

export const MONTHLY_CREDIT_GRANT_PENCE = 3000; // £30

export type CreditTransactionKind = "grant" | "spend" | "topup" | "refund";

export interface CreditTransaction {
  id: string;
  at: string;
  kind: CreditTransactionKind;
  // Positive for grant/topup/refund, negative for spend.
  amountPence: number;
  description: string;
}

export interface CreditLedger {
  balancePence: number;
  // The UTC month ("2026-09") the free monthly grant was last given. A
  // dealership that has never been a PAYING Pilot Brain subscriber has
  // never had one, so its balance is only ever what it has topped up
  // itself — which is the whole point during the free trial ("Wendy's
  // voice and lookups are paid as used even in the trial").
  lastGrantMonth: string;
  transactions: CreditTransaction[];
}

const COLLECTION = "pilotBrainCredit";
const TRANSACTIONS_KEPT = 200;
const RECENT_SHOWN = 20;

function utcMonth(now: number): string {
  return new Date(now).toISOString().slice(0, 7);
}

export function readCreditLedger(dealershipId: string): CreditLedger {
  const raw = readTenantDoc<Partial<CreditLedger> | null>(dealershipId, COLLECTION, null);
  return {
    balancePence: typeof raw?.balancePence === "number" ? raw.balancePence : 0,
    lastGrantMonth: typeof raw?.lastGrantMonth === "string" ? raw.lastGrantMonth : "",
    transactions: Array.isArray(raw?.transactions) ? raw.transactions : [],
  };
}

function saveCreditLedger(dealershipId: string, ledger: CreditLedger): void {
  writeTenantDoc(dealershipId, COLLECTION, { ...ledger, transactions: ledger.transactions.slice(-TRANSACTIONS_KEPT) });
}

function withTransaction(
  ledger: CreditLedger,
  kind: CreditTransactionKind,
  amountPence: number,
  description: string,
  now: number
): CreditLedger {
  return {
    ...ledger,
    balancePence: ledger.balancePence + amountPence,
    transactions: [...ledger.transactions, { id: randomUUID(), at: new Date(now).toISOString(), kind, amountPence, description }],
  };
}

/**
 * Gives this month's £30 credit, once, only to a dealership that is really
 * paying for Pilot Brain right now — never to a trial, and never twice in
 * the same UTC month even if this runs on every single request (it is
 * called on every read/spend rather than by a scheduled job, same "compute
 * it when it's needed" style as the rest of this app).
 */
export function ensureMonthlyGrant(dealershipId: string, pilotBrainEnabled: boolean, now: number = Date.now()): CreditLedger {
  const ledger = readCreditLedger(dealershipId);
  if (!pilotBrainEnabled) return ledger;
  const month = utcMonth(now);
  if (ledger.lastGrantMonth === month) return ledger;
  const granted = withTransaction({ ...ledger, lastGrantMonth: month }, "grant", MONTHLY_CREDIT_GRANT_PENCE, "This month's Pilot Brain usage credit", now);
  saveCreditLedger(dealershipId, granted);
  return granted;
}

/** Whether the balance covers one use of `kind` right now, without spending anything. */
export function canAfford(dealershipId: string, kind: CreditSpendKind, pilotBrainEnabled: boolean, now: number = Date.now()): boolean {
  const ledger = ensureMonthlyGrant(dealershipId, pilotBrainEnabled, now);
  return ledger.balancePence >= RATE_CARD_PENCE[kind];
}

/**
 * Spends for one real use (one web lookup, one spoken reply). Refuses,
 * changing nothing, if the balance can't cover it — callers must check
 * BEFORE doing the paid work, since a deduction here can't undo a lookup
 * or a voice reply that has already happened.
 */
export function spendCredit(
  dealershipId: string,
  kind: CreditSpendKind,
  pilotBrainEnabled: boolean,
  now: number = Date.now()
): { ok: true; remainingPence: number } | { ok: false; remainingPence: number } {
  const ledger = ensureMonthlyGrant(dealershipId, pilotBrainEnabled, now);
  const cost = RATE_CARD_PENCE[kind];
  if (ledger.balancePence < cost) return { ok: false, remainingPence: ledger.balancePence };
  const spent = withTransaction(ledger, "spend", -cost, kind === "webLookup" ? "Live web lookup" : "Spoken (voice) reply", now);
  saveCreditLedger(dealershipId, spent);
  return { ok: true, remainingPence: spent.balancePence };
}

/** The paid work failed after the spend (e.g. the voice provider errored) — give the credit back. */
export function refundCredit(dealershipId: string, kind: CreditSpendKind, description: string, now: number = Date.now()): CreditLedger {
  const ledger = readCreditLedger(dealershipId);
  const refunded = withTransaction(ledger, "refund", RATE_CARD_PENCE[kind], description, now);
  saveCreditLedger(dealershipId, refunded);
  return refunded;
}

/** A real card top-up, confirmed by Stripe's webhook — never trusted from a client request directly. */
export function addTopUp(dealershipId: string, amountPence: number, reference: string, now: number = Date.now()): CreditLedger {
  const ledger = readCreditLedger(dealershipId);
  const topped = withTransaction(ledger, "topup", amountPence, `Card top-up (${reference})`, now);
  saveCreditLedger(dealershipId, topped);
  return topped;
}

export interface CreditSummary {
  balancePence: number;
  rateCardPence: typeof RATE_CARD_PENCE;
  monthlyGrantPence: number;
  recentTransactions: CreditTransaction[];
}

export function creditSummary(dealershipId: string, pilotBrainEnabled: boolean, now: number = Date.now()): CreditSummary {
  const ledger = ensureMonthlyGrant(dealershipId, pilotBrainEnabled, now);
  return {
    balancePence: ledger.balancePence,
    rateCardPence: RATE_CARD_PENCE,
    monthlyGrantPence: pilotBrainEnabled ? MONTHLY_CREDIT_GRANT_PENCE : 0,
    recentTransactions: ledger.transactions.slice(-RECENT_SHOWN).reverse(),
  };
}

// What a dealer may actually buy at once — matches the decided top-up
// amounts (10/25/50 pounds). A client-supplied amount is refused unless
// it's one of these.
export const TOPUP_AMOUNTS_PENCE = [1000, 2500, 5000] as const;
export function isValidTopUpAmount(pence: unknown): pence is (typeof TOPUP_AMOUNTS_PENCE)[number] {
  return typeof pence === "number" && (TOPUP_AMOUNTS_PENCE as readonly number[]).includes(pence);
}
