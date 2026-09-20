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
