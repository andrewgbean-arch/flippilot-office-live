import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/context/LeadsContext", () => ({
  useLeads: () => ({ leads: [{ id: "l1", name: "Sam Buyer", phone: "07000 000000" }] }),
}));

import FinanceCalculator from "./FinanceCalculator";
import DealSheet from "./DealSheet";
import LenderComparison from "./LenderComparison";
import TradeInValuation from "./TradeInValuation";
import ProfitBreakdown from "./ProfitBreakdown";
import FinanceHub from "./FinanceHub";
import FinanceWorkflow from "@/dealer/workflow/FinanceWorkflow";

// What a dealer sees the moment each finance screen opens. Nothing here may
// look like a quote, a rate or a lender that nobody has entered.

const html = {
  calculator: renderToStaticMarkup(<FinanceCalculator />),
  dealSheet: renderToStaticMarkup(<DealSheet />),
  lenders: renderToStaticMarkup(<LenderComparison />),
  tradeIn: renderToStaticMarkup(<TradeInValuation />),
  profit: renderToStaticMarkup(<ProfitBreakdown />),
  hub: renderToStaticMarkup(<MemoryRouter><FinanceHub /></MemoryRouter>),
  workflow: renderToStaticMarkup(<FinanceWorkflow />),
};

const NO_QUOTE_WORDS = /Illustrative only/;

describe("finance screens as first opened", () => {
  it("no screen ships a pre-filled rate", () => {
    for (const [name, out] of Object.entries(html)) {
      expect(out, name).not.toMatch(/9\.9|12\.5|7\.4/);
    }
    // The APR boxes are empty and say what to enter.
    for (const out of [html.calculator, html.dealSheet]) {
      expect(out).toMatch(/placeholder="Enter the rate you have been quoted"[^>]*value=""/);
    }
  });

  it("the calculator, deal sheet and lender comparison all say illustrative, not a finance quote or credit offer", () => {
    for (const out of [html.calculator, html.dealSheet, html.lenders, html.workflow]) {
      expect(out).toMatch(NO_QUOTE_WORDS);
      expect(out).toContain("not a finance quote or a credit offer");
      expect(out).toContain("subject to status");
    }
  });

  it("the calculator asks for what is missing instead of printing £0.00", () => {
    expect(html.calculator).toContain("Enter the amount to finance.");
    expect(html.calculator).not.toContain("£0.00");
    expect(html.calculator).not.toContain("powered by");
  });

  it("the disclaimer sits with the figures themselves, not only in the page header", () => {
    expect(html.calculator.split("Finance Inputs")[0]).toContain("not a finance quote or a credit offer");
    expect(html.calculator.split("Monthly Payment (illustrative)")[1]).toContain("not a finance quote or a credit offer");
    expect(html.dealSheet.split("Summary (illustrative)")[1]).toContain("not a finance quote or a credit offer");
  });

  it("the deal sheet shows dashes, not zero money, until figures are entered", () => {
    expect(html.dealSheet).not.toContain("£0.00");
    expect(html.dealSheet).not.toContain("NaN");
    expect(html.dealSheet).not.toContain("Infinity");
    expect(html.dealSheet).toContain("Summary (illustrative)");
  });

  it("the lender comparison starts empty: no placeholder lenders and no 'Best Rate' badge", () => {
    expect(html.lenders).not.toMatch(/Lender [ABC]\b/);
    expect(html.lenders).not.toContain("Best Rate");
    expect(html.lenders).not.toContain("sn-lender-card");
    expect(html.lenders).toContain("No lenders added yet");
    expect(html.lenders).toContain("Add a lender");
    expect(html.lenders).toContain("Nothing is pre-filled");
    // ...and the loan amount is empty too, not a made-up 10,000.
    expect(html.lenders).toMatch(/<label>Loan Amount \(£\)<\/label><input[^>]*value=""/);
  });

  describe("lender comparison once the dealer has typed lenders in", () => {
    const two = [
      { id: "a", name: "Northern Motor Finance", apr: "9.9" },
      { id: "b", name: "Harbour Credit", apr: "12.5" },
    ];
    const render = (lenders: typeof two, amount = "10000") =>
      renderToStaticMarkup(<LenderComparison initialLenders={lenders} initialAmount={amount} />);

    it("marks only the lower payment, once, with 'Lowest monthly payment' and never 'Best Rate'", () => {
      const out = render(two);
      expect(out.match(/sn-lender-badge/g)).toHaveLength(1);
      expect(out).toContain("Lowest monthly payment");
      expect(out).not.toContain("Best Rate");
      // The badge is on the first card (9.9%), not the second (12.5%).
      const first = out.split("Harbour Credit")[0];
      expect(first).toContain("sn-lender-badge");
      expect(out.split("Harbour Credit")[1]).not.toContain("sn-lender-badge");
      expect(out).toContain("£320.22");
    });

    it("marks nothing for a single lender", () => {
      const out = render([two[0]]);
      expect(out).not.toContain("sn-lender-badge");
      expect(out).toContain("£320.22");
    });

    it("says what is missing for a lender with no APR, and marks nothing", () => {
      const out = render([{ id: "a", name: "Northern Motor Finance", apr: "" }, two[1]]);
      expect(out).not.toContain("sn-lender-badge");
      expect(out).toContain("Enter an APR");
    });

    it("shows a 0% lender as amount over months", () => {
      const out = render([{ id: "z", name: "Dealer promotion", apr: "0" }], "10000");
      expect(out).toContain("£277.78");
    });

    it("asks for the loan amount when there is none, instead of £0.00", () => {
      const out = render(two, "");
      expect(out).toContain("Enter the amount to finance.");
      expect(out).not.toContain("sn-lender-badge");
    });
  });

  it("the trade-in screen shows its percentages as an adjustable rule of thumb and no longer collects unused year and mileage", () => {
    expect(html.tradeIn).toContain("rule of thumb");
    expect(html.tradeIn).toContain("Excellent 0%");
    expect(html.tradeIn).toContain("Good 5%");
    expect(html.tradeIn).toContain("Fair 12%");
    expect(html.tradeIn).toContain("Poor 22%");
    expect(html.tradeIn).toContain("Condition allowance (% off the market value)");
    expect(html.tradeIn).toContain("Your margin (% off before making an offer)");
    expect(html.tradeIn).not.toContain(">Year<");
    expect(html.tradeIn).not.toContain(">Mileage<");
    expect(html.tradeIn).not.toContain("Trade-In Offer");
    expect(html.tradeIn).toContain("illustrative");
    expect(html.tradeIn).not.toContain("AutoTrader");
  });

  it("the profit breakdown asks for the two figures it needs before showing any profit", () => {
    expect(html.profit).toContain("Enter the purchase price and the sale price");
    expect(html.profit).not.toContain("£0.00");
    expect(html.profit).toContain("VAT margin scheme");
    expect(html.profit).not.toContain("NaN");
  });

  it("the hub no longer promises rate comparison across lenders or a 'fair' trade-in offer", () => {
    expect(html.hub).not.toContain("Compare rates across lenders");
    expect(html.hub).not.toContain("fair trade-in offer");
    expect(html.hub).not.toContain("Generate a printable sale contract");
    expect(html.hub).toContain("not a finance");
    expect(html.hub).toContain("Check it before use");
  });
});
