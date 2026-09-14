import { describe, it, expect } from "vitest";
import { countLeaveWorkingDays } from "./dateUtils";

describe("countLeaveWorkingDays", () => {
  it("counts only the person's own working days within a Mon–Fri week off", () => {
    // Mon 2026-09-14 .. Fri 2026-09-18, full-time Mon–Fri pattern
    const days = countLeaveWorkingDays("2026-09-14", "2026-09-18", ["mon", "tue", "wed", "thu", "fri"]);
    expect(days).toBe(5);
  });

  it("excludes weekends even when the range spans them", () => {
    // Fri 2026-09-18 .. Mon 2026-09-21 (includes Sat/Sun)
    const days = countLeaveWorkingDays("2026-09-18", "2026-09-21", ["mon", "tue", "wed", "thu", "fri"]);
    expect(days).toBe(2); // Fri + Mon only
  });

  it("charges a part-timer only for the days they actually work", () => {
    // Same Mon–Fri week, but this person only works Tue/Thu
    const days = countLeaveWorkingDays("2026-09-14", "2026-09-18", ["tue", "thu"]);
    expect(days).toBe(2);
  });

  it("falls back to a plain Mon–Fri week when no work pattern is set", () => {
    const days = countLeaveWorkingDays("2026-09-14", "2026-09-20", []); // full calendar week
    expect(days).toBe(5);
  });

  it("counts a single-day request as one day", () => {
    expect(countLeaveWorkingDays("2026-09-14", "2026-09-14", ["mon"])).toBe(1);
  });
});
