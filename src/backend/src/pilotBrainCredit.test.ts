import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect } from "vitest";
import {
  RATE_CARD_PENCE,
  MONTHLY_CREDIT_GRANT_PENCE,
  TOPUP_AMOUNTS_PENCE,
  readCreditLedger,
  ensureMonthlyGrant,
  canAfford,
  spendCredit,
  refundCredit,
  addTopUp,
  creditSummary,
  isValidTopUpAmount,
} from "./pilotBrainCredit.js";

const dealershipId = () => `credit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const JAN_1 = Date.parse("2027-01-01T00:00:00.000Z");
const JAN_15 = Date.parse("2027-01-15T00:00:00.000Z");
const FEB_1 = Date.parse("2027-02-01T00:00:00.000Z");

describe("a dealership that has never paid for Pilot Brain", () => {
  it("starts at zero, gets no monthly grant, and cannot afford anything", () => {
    const id = dealershipId();
    expect(readCreditLedger(id)).toMatchObject({ balancePence: 0, transactions: [] });
    expect(ensureMonthlyGrant(id, false, JAN_1).balancePence).toBe(0);
    expect(canAfford(id, "webLookup", false, JAN_1)).toBe(false);
    expect(canAfford(id, "voiceReply", false, JAN_1)).toBe(false);
  });

  it("can still be topped up and spend from that, exactly as much as it topped up", () => {
    const id = dealershipId();
    addTopUp(id, 1000, "cs_test_1", JAN_1);
    expect(readCreditLedger(id).balancePence).toBe(1000);
    expect(canAfford(id, "voiceReply", false, JAN_1)).toBe(true);

    const spends = Math.floor(1000 / RATE_CARD_PENCE.voiceReply);
    for (let i = 0; i < spends; i++) {
      expect(spendCredit(id, "voiceReply", false, JAN_1).ok).toBe(true);
    }
    expect(readCreditLedger(id).balancePence).toBeLessThan(RATE_CARD_PENCE.voiceReply);
    expect(spendCredit(id, "voiceReply", false, JAN_1).ok).toBe(false);
  });
});

describe("a paying Pilot Brain subscriber", () => {
  it("gets the monthly grant once, not again on the same month, and again the next month", () => {
    const id = dealershipId();
    const first = ensureMonthlyGrant(id, true, JAN_1);
    expect(first.balancePence).toBe(MONTHLY_CREDIT_GRANT_PENCE);
    expect(first.transactions).toHaveLength(1);
    expect(first.transactions[0]).toMatchObject({ kind: "grant", amountPence: MONTHLY_CREDIT_GRANT_PENCE });

    const stillJanuary = ensureMonthlyGrant(id, true, JAN_15);
    expect(stillJanuary.balancePence).toBe(MONTHLY_CREDIT_GRANT_PENCE);
    expect(stillJanuary.transactions).toHaveLength(1);

    const february = ensureMonthlyGrant(id, true, FEB_1);
    expect(february.balancePence).toBe(MONTHLY_CREDIT_GRANT_PENCE * 2);
    expect(february.transactions).toHaveLength(2);
  });

  it("spends the rate card, refuses once the balance can't cover it, and a refund gives it back", () => {
    const id = dealershipId();
    ensureMonthlyGrant(id, true, JAN_1);

    const before = readCreditLedger(id).balancePence;
    const spent = spendCredit(id, "webLookup", true, JAN_1);
    expect(spent).toEqual({ ok: true, remainingPence: before - RATE_CARD_PENCE.webLookup });

    const refunded = refundCredit(id, "webLookup", "Refunded: test", JAN_1);
    expect(refunded.balancePence).toBe(before);
    expect(refunded.transactions.at(-1)).toMatchObject({ kind: "refund", amountPence: RATE_CARD_PENCE.webLookup });
  });

  it("never spends below zero, and a spend that is refused changes nothing", () => {
    const id = dealershipId();
    // A subscriber with no grant yet this "month" and nothing topped up.
    const attempt = spendCredit(id, "voiceReply", false, JAN_1);
    expect(attempt).toEqual({ ok: false, remainingPence: 0 });
    expect(readCreditLedger(id).transactions).toHaveLength(0);
  });

  it("a top-up is additional to, not instead of, the monthly grant", () => {
    const id = dealershipId();
    ensureMonthlyGrant(id, true, JAN_1);
    addTopUp(id, 2500, "cs_test_2", JAN_1);
    expect(readCreditLedger(id).balancePence).toBe(MONTHLY_CREDIT_GRANT_PENCE + 2500);
  });
});

describe("creditSummary", () => {
  it("shows the balance, the rate card, the monthly grant only for a real subscriber, and recent transactions newest first", () => {
    const id = dealershipId();
    addTopUp(id, 1000, "cs_a", JAN_1);
    addTopUp(id, 500, "cs_b", JAN_1 + 1000);
    const summary = creditSummary(id, false, JAN_1 + 2000);
    expect(summary).toMatchObject({ balancePence: 1500, rateCardPence: RATE_CARD_PENCE, monthlyGrantPence: 0 });
    expect(summary.recentTransactions[0]).toMatchObject({ description: "Card top-up (cs_b)" });
    expect(summary.recentTransactions[1]).toMatchObject({ description: "Card top-up (cs_a)" });

    const paid = creditSummary(id, true, JAN_1 + 2000);
    expect(paid.monthlyGrantPence).toBe(MONTHLY_CREDIT_GRANT_PENCE);
  });

  it("keeps only the most recent transactions shown, without losing the real balance", () => {
    const id = dealershipId();
    for (let i = 0; i < 30; i++) addTopUp(id, 100, `cs_${i}`, JAN_1 + i);
    const summary = creditSummary(id, false, JAN_1 + 100);
    expect(summary.balancePence).toBe(3000);
    expect(summary.recentTransactions.length).toBeLessThanOrEqual(20);
    expect(summary.recentTransactions[0]).toMatchObject({ description: "Card top-up (cs_29)" });
  });
});

describe("isValidTopUpAmount", () => {
  it("accepts only the three offered amounts", () => {
    for (const p of TOPUP_AMOUNTS_PENCE) expect(isValidTopUpAmount(p)).toBe(true);
    for (const bad of [0, -1000, 999, 100000, NaN, "1000", null, undefined]) {
      expect(isValidTopUpAmount(bad)).toBe(false);
    }
  });
});

describe("dealership isolation", () => {
  it("one dealership's credit is never another's", () => {
    const a = dealershipId();
    const b = dealershipId();
    addTopUp(a, 5000, "cs_a", JAN_1);
    expect(readCreditLedger(b).balancePence).toBe(0);
  });
});
