import { describe, it, expect } from "vitest";
import {
  CONDITION_ALLOWANCE_DEFAULT_PCT,
  DEFAULT_TRADE_IN_MARGIN_PCT,
  FINANCE_DISCLAIMER,
  amountToFinance,
  calculateLoan,
  compareLenders,
  dealSheetFigures,
  loanPayment,
  monthlyRateFromApr,
  tradeInFigures,
} from "./financeMath";

// Numbers a dealer could hand to a customer. Reference figures below were
// worked out independently of the code (the audit's 320.22 and 277.78, and a
// standard annuity at 1% a month).

describe("APR to a monthly rate", () => {
  it("treats APR as an effective annual rate: 12.6825% a year is exactly 1% a month", () => {
    expect(monthlyRateFromApr(12.682503013196977)).toBeCloseTo(0.01, 10);
  });

  it("is zero at 0%", () => {
    expect(monthlyRateFromApr(0)).toBe(0);
  });
});

describe("loanPayment", () => {
  it("£10,000 over 36 months at 9.9% APR is £320.22 (the old nominal maths said £322.20)", () => {
    const p = loanPayment(10000, 36, 9.9);
    expect(p).toBeCloseTo(320.2234, 3);
    expect(Math.abs(p - 322.2026)).toBeGreaterThan(1.9);
  });

  it("matches a standard annuity at 1% a month when the APR is that rate's effective annual equivalent", () => {
    const annuity = (1200 * 0.01) / (1 - Math.pow(1.01, -12));
    expect(loanPayment(1200, 12, 12.682503013196977)).toBeCloseTo(annuity, 6);
  });

  it("0% APR is the amount divided by the months, never 0.00", () => {
    expect(loanPayment(10000, 36, 0)).toBeCloseTo(277.7778, 4);
    expect(loanPayment(6000, 12, 0)).toBe(500);
  });

  it("a rate so small it rounds to nothing still gives the 0% answer, not NaN or Infinity", () => {
    const p = loanPayment(10000, 36, 1e-15);
    expect(Number.isFinite(p)).toBe(true);
    expect(p).toBeCloseTo(277.7778, 3);
  });

  it("gets dearer as the APR rises and cheaper as the term lengthens", () => {
    expect(loanPayment(10000, 36, 12)).toBeGreaterThan(loanPayment(10000, 36, 6));
    expect(loanPayment(10000, 48, 9.9)).toBeLessThan(loanPayment(10000, 36, 9.9));
  });

  it("always repays at least the amount borrowed", () => {
    for (const apr of [0, 0.9, 4.9, 9.9, 19.9, 29.9]) {
      for (const months of [6, 12, 36, 60, 84]) {
        expect(loanPayment(8000, months, apr) * months).toBeGreaterThanOrEqual(8000 - 1e-6);
      }
    }
  });
});

describe("calculateLoan", () => {
  it("gives the payment, the total repayable and the interest", () => {
    const r = calculateLoan(10000, "36", "9.9");
    expect(r.status).toBe("ok");
    expect(r.monthlyPayment).toBeCloseTo(320.2234, 3);
    expect(r.totalRepayable).toBeCloseTo(320.2234 * 36, 2);
    expect(r.totalInterest).toBeCloseTo(320.2234 * 36 - 10000, 2);
    expect(r.message).toBeNull();
  });

  it("0% APR typed in is a real entry: amount / months, no interest, and not 'incomplete'", () => {
    for (const zero of [0, "0", "0.0"]) {
      const r = calculateLoan(10000, 36, zero);
      expect(r.status).toBe("ok");
      expect(r.monthlyPayment).toBeCloseTo(277.7778, 4);
      expect(r.totalInterest).toBeCloseTo(0, 6);
    }
  });

  it("a blank APR is not 0%: it asks for one", () => {
    for (const blank of ["", "  ", null, undefined]) {
      const r = calculateLoan(10000, 36, blank);
      expect(r.status).toBe("incomplete");
      expect(r.monthlyPayment).toBeNull();
      expect(r.message).toContain("APR");
    }
  });

  it("a blank term asks for one, a bad term is invalid, and none of them gives Infinity", () => {
    expect(calculateLoan(10000, "", 9.9).status).toBe("incomplete");
    for (const bad of [0, "0", -12, 36.5, "abc"]) {
      const r = calculateLoan(10000, bad, 9.9);
      expect(r.status).toBe("invalid");
      expect(r.monthlyPayment).toBeNull();
    }
  });

  it("a negative or unreadable APR is invalid", () => {
    expect(calculateLoan(10000, 36, -1).status).toBe("invalid");
    expect(calculateLoan(10000, 36, "x").status).toBe("invalid");
  });

  it("no amount yet is incomplete; nothing or less than nothing to finance says so", () => {
    expect(calculateLoan(null, 36, 9.9).status).toBe("incomplete");
    expect(calculateLoan(0, 36, 9.9).status).toBe("no-balance");
    expect(calculateLoan(-500, 36, 9.9).status).toBe("no-balance");
  });
});

describe("amountToFinance", () => {
  it("is price minus deposit, with a blank deposit meaning none", () => {
    expect(amountToFinance("12000", "2000")).toBe(10000);
    expect(amountToFinance(12000, "")).toBe(12000);
  });

  it("is null until a price is entered, and negative when the deposit is more than the price", () => {
    expect(amountToFinance("", "500")).toBeNull();
    expect(amountToFinance(1000, 1500)).toBe(-500);
  });
});

describe("dealSheetFigures", () => {
  const base = { salePrice: 15000, tradeInValue: 3000, deposit: 2000, months: 48, apr: 6.9 };

  it("balance to finance is the sale price less trade-in and deposit", () => {
    const f = dealSheetFigures(base);
    expect(f.balanceToFinance).toBe(10000);
    expect(f.surplus).toBe(0);
    expect(f.loan.status).toBe("ok");
    expect(f.loan.monthlyPayment).toBeCloseTo(loanPayment(10000, 48, 6.9), 8);
  });

  it("total payable is the sale price plus the interest (deposit and trade-in are part of the price)", () => {
    const f = dealSheetFigures(base);
    expect(f.totalPayable).toBeCloseTo(15000 + (f.loan.totalInterest as number), 6);
    expect(f.totalPayable!).toBeGreaterThan(15000);
  });

  it("at 0% APR the payment is the balance over the months and the total is just the sale price", () => {
    const f = dealSheetFigures({ ...base, apr: "0" });
    expect(f.loan.monthlyPayment).toBeCloseTo(10000 / 48, 6);
    expect(f.totalPayable).toBeCloseTo(15000, 6);
  });

  it("with no APR entered it shows no payment and no total, rather than assuming a rate", () => {
    const f = dealSheetFigures({ ...base, apr: "" });
    expect(f.loan.status).toBe("incomplete");
    expect(f.loan.monthlyPayment).toBeNull();
    expect(f.totalPayable).toBeNull();
    expect(f.balanceToFinance).toBe(10000); // the plain subtraction still shows
  });

  it("when trade-in and deposit cover the price there is nothing to finance and the surplus is shown", () => {
    const f = dealSheetFigures({ ...base, tradeInValue: 9000, deposit: 7000 });
    expect(f.balanceToFinance).toBe(-1000);
    expect(f.surplus).toBe(1000);
    expect(f.loan.status).toBe("no-balance");
    expect(f.loan.monthlyPayment).toBeNull();
    expect(f.totalPayable).toBe(15000);
  });

  it("a term of 0 gives no payment (never Infinity)", () => {
    const f = dealSheetFigures({ ...base, months: 0 });
    expect(f.loan.status).toBe("invalid");
    expect(f.totalPayable).toBeNull();
  });

  it("blank trade-in and deposit are none; a blank sale price gives nothing", () => {
    const f = dealSheetFigures({ salePrice: 9000, tradeInValue: "", deposit: "", months: 36, apr: 0 });
    expect(f.balanceToFinance).toBe(9000);
    const empty = dealSheetFigures({ salePrice: "", tradeInValue: "", deposit: "", months: "", apr: "" });
    expect(empty.salePrice).toBeNull();
    expect(empty.balanceToFinance).toBeNull();
    expect(empty.totalPayable).toBeNull();
  });
});

describe("compareLenders", () => {
  const lender = (id: string, apr: string, name = `Lender ${id}`) => ({ id, name, apr });

  it("starts empty: no lenders in, no rows out", () => {
    expect(compareLenders(10000, 36, [])).toEqual([]);
  });

  it("one lender is not a comparison: no lowest mark", () => {
    const rows = compareLenders(10000, 36, [lender("a", "9.9")]);
    expect(rows[0]?.loan.status).toBe("ok");
    expect(rows[0]?.isLowest).toBe(false);
  });

  it("marks the lowest payment when two or more usable rates differ", () => {
    const rows = compareLenders(10000, 36, [lender("a", "9.9"), lender("b", "12.5"), lender("c", "7.4")]);
    expect(rows.map((r) => r.isLowest)).toEqual([false, false, true]);
  });

  it("marks every lender at the lowest payment when they tie", () => {
    const rows = compareLenders(10000, 36, [lender("a", "7.4"), lender("b", "12.5"), lender("c", "7.4")]);
    expect(rows.map((r) => r.isLowest)).toEqual([true, false, true]);
  });

  it("marks nothing when every rate is the same", () => {
    const rows = compareLenders(10000, 36, [lender("a", "9.9"), lender("b", "9.9")]);
    expect(rows.some((r) => r.isLowest)).toBe(false);
  });

  it("a lender with no APR yet is left out of the comparison, and 0% counts as a real rate", () => {
    const rows = compareLenders(10000, 36, [lender("a", ""), lender("b", "9.9"), lender("c", "0")]);
    expect(rows[0]?.loan.status).toBe("incomplete");
    expect(rows[0]?.isLowest).toBe(false);
    expect(rows[2]?.loan.monthlyPayment).toBeCloseTo(277.7778, 4);
    expect(rows.map((r) => r.isLowest)).toEqual([false, false, true]);
  });

  it("a lone usable lender next to a blank one is not a comparison", () => {
    const rows = compareLenders(10000, 36, [lender("a", ""), lender("b", "9.9")]);
    expect(rows.some((r) => r.isLowest)).toBe(false);
  });

  it("without a loan amount or term nothing is worked out and nothing is marked", () => {
    for (const [amount, months] of [["", 36], [10000, ""], [10000, 0]] as const) {
      const rows = compareLenders(amount, months, [lender("a", "9.9"), lender("b", "5")]);
      expect(rows.every((r) => r.loan.status !== "ok")).toBe(true);
      expect(rows.some((r) => r.isLowest)).toBe(false);
    }
  });
});

describe("tradeInFigures", () => {
  it("market value less the condition allowance, then the dealer's margin, then finance owed", () => {
    const f = tradeInFigures({ marketValue: 10000, allowancePct: 5, marginPct: 10, outstandingFinance: 2000 });
    expect(f.ready).toBe(true);
    expect(f.allowance).toBe(500);
    expect(f.adjustedValue).toBe(9500);
    expect(f.margin).toBe(950);
    expect(f.offerBeforeFinance).toBe(8550);
    expect(f.paidToCustomer).toBe(6550);
    expect(f.shortfall).toBe(0);
  });

  it("finance owed beyond the offer is a shortfall, never a negative offer", () => {
    const f = tradeInFigures({ marketValue: 5000, allowancePct: 12, marginPct: 10, outstandingFinance: 6000 });
    expect(f.offerBeforeFinance).toBeCloseTo(3960, 6);
    expect(f.paidToCustomer).toBe(0);
    expect(f.shortfall).toBeCloseTo(2040, 6);
  });

  it("no market value yet means no offer at all", () => {
    for (const blank of ["", null, undefined, "abc", -5]) {
      const f = tradeInFigures({ marketValue: blank, allowancePct: 5, marginPct: 10, outstandingFinance: "" });
      expect(f.ready).toBe(false);
      expect(f.offerBeforeFinance).toBeNull();
      expect(f.paidToCustomer).toBeNull();
    }
  });

  it("blank percentages mean none, and a percentage over 100 is held at 100", () => {
    const none = tradeInFigures({ marketValue: 8000, allowancePct: "", marginPct: "", outstandingFinance: "" });
    expect(none.offerBeforeFinance).toBe(8000);
    const over = tradeInFigures({ marketValue: 8000, allowancePct: 250, marginPct: 0, outstandingFinance: "" });
    expect(over.offerBeforeFinance).toBe(0);
  });

  it("the starting rules of thumb are the ones the old screen applied silently, now shown and editable", () => {
    expect(CONDITION_ALLOWANCE_DEFAULT_PCT).toEqual({ excellent: 0, good: 5, fair: 12, poor: 22 });
    expect(DEFAULT_TRADE_IN_MARGIN_PCT).toBe(10);
  });
});

describe("disclaimer", () => {
  it("says illustrative, not a finance quote, not a credit offer, subject to status", () => {
    const text = FINANCE_DISCLAIMER.toLowerCase();
    expect(text).toContain("illustrative only");
    expect(text).toContain("not a finance quote");
    expect(text).toContain("credit offer");
    expect(text).toContain("subject to status");
  });
});
