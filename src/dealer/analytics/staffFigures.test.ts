import { describe, it, expect } from "vitest";
import { averageDaysOnApp } from "./staffFigures";

const NOW = new Date("2026-06-01T12:00:00Z");
const daysAgo = (n: number) => ({ joinedAt: new Date(NOW.getTime() - n * 86_400_000).toISOString() });

describe("average days on FlipPilot", () => {
  it("averages the days since each staff record was created", () => {
    expect(averageDaysOnApp([daysAgo(10), daysAgo(30)], NOW)).toBe(20);
  });

  it("leaves out a record with no usable date instead of turning the whole average into NaN", () => {
    expect(averageDaysOnApp([daysAgo(10), { joinedAt: "" }, { joinedAt: "not a date" }, { joinedAt: undefined as never }], NOW)).toBe(10);
  });

  it("never counts a date in the future as negative days", () => {
    expect(averageDaysOnApp([daysAgo(-5), daysAgo(10)], NOW)).toBe(5);
  });

  it("is null, not 0, when there is nobody to average", () => {
    expect(averageDaysOnApp([], NOW)).toBeNull();
    expect(averageDaysOnApp([{ joinedAt: "" }], NOW)).toBeNull();
  });
});
