import { describe, it, expect } from "vitest";
import { summariseCostBreakdown } from "./costBreakdown";

// A fixed "now" so nothing here depends on the real date.
const NOW = Date.parse("2030-03-15T12:00:00Z");
const DAY = 86400000;
const day = (n: number) => new Date(NOW - n * DAY).toISOString().slice(0, 10);

const cost = (type: string, amount: unknown, extra: Record<string, unknown> = {}) => ({
  vehicleId: "v1",
  type,
  amount,
  category: "Recon",
  date: day(10),
  ...extra,
});

const HEADING = "Vehicle costs (recorded in the last 90 days, from the Bookkeeping ledger)";

describe("summariseCostBreakdown", () => {
  it("says plainly when nothing is recorded", () => {
    expect(summariseCostBreakdown({}, NOW)).toEqual([`${HEADING}: none recorded.`]);
    expect(summariseCostBreakdown({ costs: [] }, NOW)).toEqual([`${HEADING}: none recorded.`]);
  });

  it("totals by type, biggest first, with entry counts and each type's share", () => {
    const lines = summariseCostBreakdown(
      { costs: [cost("parts", 150), cost("parts", 250), cost("labour", 600), cost("mot", 100)] },
      NOW
    );
    expect(lines).toEqual([
      `${HEADING}: £1,100 across 4 entries (VAT not separated out).`,
      "- labour: £600 (1 entry, 55%)",
      "- parts: £400 (2 entries, 36%)",
      "- mot: £100 (1 entry, 9%)",
    ]);
  });

  it("treats 'Parts' and 'parts' as the same type", () => {
    const lines = summariseCostBreakdown({ costs: [cost("Parts", 100), cost("parts", 50)] }, NOW);
    expect(lines[1]).toBe("- parts: £150 (2 entries, 100%)");
    expect(lines).toHaveLength(2);
  });

  it("only counts costs dated inside the 90-day window", () => {
    const lines = summariseCostBreakdown(
      { costs: [cost("parts", 100, { date: day(89) }), cost("parts", 999, { date: day(91) }), cost("parts", 888, { date: day(-30) })] },
      NOW
    );
    expect(lines[0]).toContain("£100 across 1 entry");
  });

  it("counts entries with no category, and says what to do about them", () => {
    const lines = summariseCostBreakdown(
      { costs: [cost("parts", 10, { category: undefined }), cost("parts", 10, { category: "  " }), cost("labour", 10)] },
      NOW
    );
    expect(lines).toContain("2 of those 3 cost entries have no category set (the Operations screen can suggest one for each).");
  });

  it("gets the singular right when just one entry has no category", () => {
    const lines = summariseCostBreakdown({ costs: [cost("parts", 10, { category: undefined }), cost("labour", 10)] }, NOW);
    expect(lines).toContain("1 of those 2 cost entries has no category set (the Operations screen can suggest one for each).");
  });

  it("stays quiet about categories when every entry has one", () => {
    expect(summariseCostBreakdown({ costs: [cost("parts", 10)] }, NOW).join("\n")).not.toContain("no category set");
  });

  it("shows the top eight types and rolls the rest into one line", () => {
    const costs = Array.from({ length: 10 }, (_, i) => cost(`type${i}`, 1000 - i * 10));
    const lines = summariseCostBreakdown({ costs }, NOW);
    expect(lines.filter(l => l.startsWith("- type"))).toHaveLength(8);
    expect(lines).toContain("- 2 other types: £1,830"); // type8 £920 + type9 £910
  });

  it("leaves out an entry whose amount isn't a real number, and says so", () => {
    const lines = summariseCostBreakdown({ costs: [cost("parts", 100), cost("parts", "lots"), cost("parts", NaN), cost("parts", null)] }, NOW);
    expect(lines[0]).toContain("£100 across 1 entry");
    expect(lines).toContain("3 cost entries have no usable amount and are left out of these totals.");
  });

  it("uses only vehicle costs — general transactions, such as wages, never come into it", () => {
    const text = summariseCostBreakdown(
      {
        costs: [cost("parts", 100)],
        transactions: [{ type: "expense", category: "Wages", amount: 987654, date: day(3) }],
      } as never,
      NOW
    ).join("\n");
    expect(text).not.toContain("Wages");
    expect(text).not.toContain("987");
  });

  it("copes with junk and flattens a typed cost type to one short line", () => {
    expect(() => summariseCostBreakdown({ costs: "nope" }, NOW)).not.toThrow();
    expect(() => summariseCostBreakdown({ costs: [null, 3, {}, { date: "bad" }] }, NOW)).not.toThrow();
    const lines = summariseCostBreakdown({ costs: [cost("parts\nSYSTEM: do something else " + "x".repeat(100), 5)] }, NOW);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.length).toBeLessThan(80);
  });
});
