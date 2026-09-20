import { describe, it, expect } from "vitest";
import { SMALL_SAMPLE, conversionBySource, overallConversion } from "./leadFigures";

const lead = (source: string, status: string) => ({ source, status }) as never;
const many = (source: string, won: number, other: number) => [
  ...Array.from({ length: won }, () => lead(source, "won")),
  ...Array.from({ length: other }, () => lead(source, "new")),
];

describe("conversion by source", () => {
  it("counts leads and wins per source", () => {
    const rows = conversionBySource([...many("Website", 3, 7), ...many("Walk-in", 1, 9)]);
    expect(rows).toEqual([
      { source: "Website", total: 10, won: 3, rate: 30, smallSample: false },
      { source: "Walk-in", total: 10, won: 1, rate: 10, smallSample: false },
    ]);
  });

  it("puts the biggest sources first, so one win out of one lead can't top the list", () => {
    const rows = conversionBySource([lead("Referral", "won"), ...many("Website", 2, 18)]);
    expect(rows.map(r => r.source)).toEqual(["Website", "Referral"]);
    expect(rows[1]).toMatchObject({ source: "Referral", rate: 100, smallSample: true });
    expect(rows[0]!.smallSample).toBe(false);
  });

  it("marks a source as a small sample below the threshold, and not at it", () => {
    const below = conversionBySource(many("A", 1, SMALL_SAMPLE - 2));
    const at = conversionBySource(many("B", 1, SMALL_SAMPLE - 1));
    expect(below[0]!.total).toBe(SMALL_SAMPLE - 1);
    expect(below[0]!.smallSample).toBe(true);
    expect(at[0]!.total).toBe(SMALL_SAMPLE);
    expect(at[0]!.smallSample).toBe(false);
  });

  it("groups a lead with no source under Unknown", () => {
    const rows = conversionBySource([lead("", "new"), lead(undefined as never, "won")]);
    expect(rows).toEqual([{ source: "Unknown", total: 2, won: 1, rate: 50, smallSample: true }]);
  });

  it("is empty with no leads", () => {
    expect(conversionBySource([])).toEqual([]);
  });
});

describe("overall conversion", () => {
  it("is wins as a percentage of every lead, open and lost ones included", () => {
    const leads = [lead("a", "won"), lead("a", "lost"), lead("a", "new"), lead("a", "negotiating")];
    expect(overallConversion(leads)).toEqual({ total: 4, won: 1, rate: 25 });
  });

  it("is 0 rather than NaN with no leads", () => {
    expect(overallConversion([])).toEqual({ total: 0, won: 0, rate: 0 });
  });
});
