import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { affordabilityEngine } from "./AffordabilityEngine";
import AffordabilitySummaryCard from "@/components/dealer/AffordabilitySummaryCard";

// "Recommended Deposit: £59" on a £10,000 car could not be read. The number was right (the smallest
// deposit that keeps the payment within 15% of income) but nothing said so, and nothing said when
// the buyer has less than it. The card now says what the figure is for, and flags a shortfall.

const car = { sellPrice: 10000 } as never;
const theme = { card: "#000", goldSoftGlow: "#111", accent: "#fc0", background: "#000", cardElevated: "#222", secondary: "#aaa", white: "#fff", muted: "#888" };
const card = (buyer: object) => renderToStaticMarkup(<AffordabilitySummaryCard vehicle={car} buyer={buyer} theme={theme} />).replace(/<!-- -->/g, "").replace(/&#x27;/g, "'");

describe("deposit advice", () => {
  it("is nothing without an income or a price", () => {
    expect(affordabilityEngine.depositAdvice(car, {})).toBeNull();
    expect(affordabilityEngine.depositAdvice({} as never, { income: 3000 })).toBeNull();
  });

  it("works out the deposit needed and flags when the buyer has less", () => {
    const advice = affordabilityEngine.depositAdvice(car, { income: 1500, expenses: 500, savings: 200, deposit: 59 })!;
    expect(advice.needed).toBeGreaterThan(1000);
    expect(advice.have).toBe(259);
    expect(advice.short).toBe(true);
    expect(advice.payment).toBe(225);
  });

  it("is not short when the buyer has enough", () => {
    const advice = affordabilityEngine.depositAdvice(car, { income: 2000, expenses: 500, savings: 20000 })!;
    expect(advice.short).toBe(false);
  });

  it("says what the figure is for on the card, and that the buyer has less", () => {
    const text = card({ income: 1500, expenses: 500, savings: 200, deposit: 59 });
    expect(text).toContain("Deposit to keep the monthly payment within 15% of income");
    expect(text).toContain("more than the £259 entered as deposit and savings");
    expect(text).not.toContain("Recommended Deposit");
  });

  it("asks for the missing details instead of printing a deposit of £0", () => {
    const text = card({});
    expect(text).toContain("Deposit guide: add the buyer's income and a price for the car to see one.");
    expect(text).not.toContain("Deposit to keep");
  });
});
