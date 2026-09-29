import { describe, it, expect } from "vitest";
import { localMonthKey, missingProfitNote, monthProfit } from "./monthProfit";

// "Profit This Month" left out sales with no purchase record without saying so,
// and worked out "this month" in UTC.

const profits: Record<string, number> = { a: 1000, b: -200, c: 500 };
const profitOf = (id: string) => (id in profits ? { profit: profits[id]! } : null);

describe("profit this month", () => {
  it("adds up this month's sales and counts the ones with no profit yet", () => {
    const sales = [
      { vehicleId: "a", date: "2026-09-03" },
      { vehicleId: "b", date: "2026-09-20" },
      { vehicleId: "x", date: "2026-09-21" }, // no purchase record
      { vehicleId: "c", date: "2026-08-31" }, // last month
    ];
    expect(monthProfit(sales, profitOf, "2026-09")).toEqual({ total: 800, counted: 2, missing: 1 });
  });

  it("says plainly when sales are left out, and nothing when none are", () => {
    expect(missingProfitNote(0)).toBeNull();
    expect(missingProfitNote(1)).toBe("Leaves out 1 sale with no purchase price");
    expect(missingProfitNote(3)).toBe("Leaves out 3 sales with no purchase price");
  });

  it("uses the dealer's own month, not UTC's", () => {
    // 1 October 00:30 in the UK is still 30 September in UTC (British Summer
    // Time); the dealer means October. The UK zone is set here so the check
    // holds on a machine that runs on UTC, like the CI servers.
    const saved = process.env.TZ;
    process.env.TZ = "Europe/London";
    try {
      const justAfterMidnight = new Date(Date.UTC(2026, 8, 30, 23, 30));
      expect(localMonthKey(justAfterMidnight)).toBe("2026-10");
      expect(localMonthKey(new Date(Date.UTC(2026, 0, 5, 12)))).toBe("2026-01");
    } finally {
      if (saved === undefined) delete process.env.TZ;
      else process.env.TZ = saved;
    }
  });

  it("a sale with no date is not counted in any month", () => {
    expect(monthProfit([{ vehicleId: "a" }], profitOf, "2026-09")).toEqual({ total: 0, counted: 0, missing: 0 });
  });
});
