import { describe, it, expect } from "vitest";
import { computePaySummary, londonDateKey, type TimeEntryLike } from "./engines/payEngine";

const U = "user-1";

function entry(id: string, clockIn: string, clockOut: string | null, userId = U): TimeEntryLike {
  return { id, userId, clockIn, clockOut };
}

function summary(entries: TimeEntryLike[], opts: Partial<{ hourlyRate: number | null; start: string; end: string }> = {}) {
  return computePaySummary({
    entries,
    userId: U,
    userName: "Test User",
    hourlyRate: opts.hourlyRate === undefined ? 12.5 : opts.hourlyRate,
    start: opts.start ?? "2026-09-14",
    end: opts.end ?? "2026-09-20",
  });
}

describe("londonDateKey — which calendar day a shift belongs to", () => {
  it("uses London time in summer (BST, UTC+1): 00:30 BST on the 19th is still the 18th in UTC", () => {
    expect(londonDateKey("2026-09-18T23:30:00Z")).toBe("2026-09-19");
  });

  it("uses London time in winter (GMT, UTC+0): 23:30 GMT stays on the same day", () => {
    expect(londonDateKey("2026-12-01T23:30:00Z")).toBe("2026-12-01");
  });

  it("an ordinary daytime shift is the same day either way", () => {
    expect(londonDateKey("2026-09-14T08:00:00Z")).toBe("2026-09-14");
  });
});

describe("computePaySummary", () => {
  it("works out gross pay from clocked hours: 8h30m at £12.50 = £106.25", () => {
    const s = summary([entry("a", "2026-09-14T08:00:00Z", "2026-09-14T16:30:00Z")]);
    expect(s.totalHours).toBe(8.5);
    expect(s.grossPay).toBe(106.25);
    expect(s.hourlyRate).toBe(12.5);
    expect(s.days).toHaveLength(1);
    expect(s.days[0]!.date).toBe("2026-09-14");
    expect(s.days[0]!.hours).toBe(8.5);
    expect(s.openShift).toBe(false);
  });

  it("adds up exactly in whole minutes — three 20-minute shifts are precisely 1 hour, not 0.99", () => {
    const s = summary(
      [
        entry("a", "2026-09-14T08:00:00Z", "2026-09-14T08:20:00Z"),
        entry("b", "2026-09-14T09:00:00Z", "2026-09-14T09:20:00Z"),
        entry("c", "2026-09-14T10:00:00Z", "2026-09-14T10:20:00Z"),
      ],
      { hourlyRate: 10 }
    );
    expect(s.totalHours).toBe(1);
    expect(s.grossPay).toBe(10);
    expect(s.days[0]!.entries).toHaveLength(3);
  });

  it("rounds money to the penny: 7h07m at £11.44 = £81.41", () => {
    const s = summary([entry("a", "2026-09-14T08:00:00Z", "2026-09-14T15:07:00Z")], { hourlyRate: 11.44 });
    expect(s.grossPay).toBe(81.41);
  });

  it("puts a shift on the London date it STARTED, not the UTC date", () => {
    const entries = [entry("late", "2026-09-18T23:30:00Z", "2026-09-19T03:30:00Z")]; // 00:30–04:30 BST on the 19th
    expect(summary(entries, { start: "2026-09-14", end: "2026-09-18" }).totalHours).toBe(0);
    const s = summary(entries, { start: "2026-09-19", end: "2026-09-19" });
    expect(s.totalHours).toBe(4);
    expect(s.days[0]!.date).toBe("2026-09-19");
  });

  it("includes both ends of the period and excludes days just outside it", () => {
    const entries = [
      entry("before", "2026-09-13T08:00:00Z", "2026-09-13T16:00:00Z"),
      entry("first", "2026-09-14T08:00:00Z", "2026-09-14T16:00:00Z"),
      entry("last", "2026-09-20T08:00:00Z", "2026-09-20T16:00:00Z"),
      entry("after", "2026-09-21T08:00:00Z", "2026-09-21T16:00:00Z"),
    ];
    const s = summary(entries);
    expect(s.days.map(d => d.date)).toEqual(["2026-09-14", "2026-09-20"]);
    expect(s.totalHours).toBe(16);
  });

  it("only counts the requested person's entries", () => {
    const s = summary([
      entry("mine", "2026-09-14T08:00:00Z", "2026-09-14T12:00:00Z"),
      entry("theirs", "2026-09-14T08:00:00Z", "2026-09-14T18:00:00Z", "someone-else"),
    ]);
    expect(s.totalHours).toBe(4);
  });

  it("does not count a shift that's still open, but flags it", () => {
    const s = summary([
      entry("done", "2026-09-14T08:00:00Z", "2026-09-14T16:00:00Z"),
      entry("open", "2026-09-15T08:00:00Z", null),
    ]);
    expect(s.totalHours).toBe(8);
    expect(s.openShift).toBe(true);
  });

  it("does not flag an open shift that started outside the period", () => {
    const s = summary([entry("open", "2026-09-25T08:00:00Z", null)]);
    expect(s.openShift).toBe(false);
  });

  it("with no pay rate set, still shows the hours but never guesses a pay figure", () => {
    const s = summary([entry("a", "2026-09-14T08:00:00Z", "2026-09-14T16:00:00Z")], { hourlyRate: null });
    expect(s.totalHours).toBe(8);
    expect(s.hourlyRate).toBeNull();
    expect(s.grossPay).toBeNull();
  });

  it("copes with garbled data instead of crashing or inventing hours", () => {
    const s = summary([
      entry("backwards", "2026-09-14T16:00:00Z", "2026-09-14T08:00:00Z"),
      entry("zero", "2026-09-14T08:00:00Z", "2026-09-14T08:00:00Z"),
      entry("junk", "2026-09-14T08:00:00Z", "not-a-date"),
      entry("good", "2026-09-14T08:00:00Z", "2026-09-14T10:00:00Z"),
    ]);
    expect(s.totalHours).toBe(2);
    expect(s.days[0]!.entries.map(e => e.id)).toEqual(["good"]);
  });

  it("returns an empty, valid summary when there's nothing in the period", () => {
    const s = summary([]);
    expect(s.totalHours).toBe(0);
    expect(s.grossPay).toBe(0);
    expect(s.days).toEqual([]);
  });
});
