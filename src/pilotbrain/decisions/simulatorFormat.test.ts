import { describe, it, expect } from "vitest";
import {
  BANNER_TITLE,
  CONFIDENCE_LABEL,
  EMPTY_FIELDS,
  KIND_LABEL,
  SOURCE_LABEL,
  bannerBody,
  buildRequest,
  formatAssumptionValue,
  formatCars,
  formatDays,
  formatFigureValue,
  formatMonths,
  formatPounds,
  formatRunDate,
  parseNumberField,
  saveAvailability,
} from "./simulatorFormat";
import { FIGURE_KINDS, MAX_SIMULATIONS, type FigureUnit } from "@/lib/decisionTypes";

describe("how numbers are written", () => {
  it("writes pounds with thousands separators, pence only when there are some, and the minus before the £", () => {
    expect(formatPounds(1234)).toBe("£1,234");
    expect(formatPounds(1234.5)).toBe("£1,234.50");
    expect(formatPounds(388.89)).toBe("£388.89");
    expect(formatPounds(1000000)).toBe("£1,000,000");
    expect(formatPounds(-500)).toBe("-£500");
    expect(formatPounds(2249.999)).toBe("£2,250");
  });

  it("never writes -£0 or -0", () => {
    expect(formatPounds(-0.001)).toBe("£0");
    expect(formatPounds(-0)).toBe("£0");
    expect(formatMonths(-0.01)).toBe("0 months");
  });

  it("writes months, days and cars with the right singular and plural, and only the decimals that matter", () => {
    expect(formatMonths(21.33)).toBe("21.3 months");
    expect(formatMonths(32)).toBe("32 months");
    expect(formatMonths(1)).toBe("1 month");
    expect(formatDays(52.5)).toBe("52.5 days");
    expect(formatDays(35)).toBe("35 days");
    expect(formatDays(1)).toBe("1 day");
    expect(formatCars(1.5)).toBe("1.5 cars");
    expect(formatCars(0.75)).toBe("0.75 cars"); // a quarter of a car is not rounded to 0.8
    expect(formatCars(1)).toBe("1 car");
    expect(formatCars(6)).toBe("6 cars");
  });

  it("writes a missing figure as Unknown in every unit, never as 0", () => {
    for (const unit of ["gbp", "cars", "days", "months", "percent", "count"] as FigureUnit[]) {
      const text = formatFigureValue({ value: null, unit });
      expect(text, unit).toBe("Unknown");
      expect(text, unit).not.toMatch(/0/);
    }
    expect(formatAssumptionValue({ value: null, unit: "gbp" })).toBe("Unknown");
  });

  it("writes a real zero as a zero (a real zero is not a missing figure)", () => {
    expect(formatFigureValue({ value: 0, unit: "gbp" })).toBe("£0");
    expect(formatFigureValue({ value: 0, unit: "cars" })).toBe("0 cars");
  });

  it("writes percentages and counts, and the text assumptions as they are", () => {
    expect(formatFigureValue({ value: 50, unit: "percent" })).toBe("50%");
    expect(formatFigureValue({ value: 7, unit: "count" })).toBe("7");
    expect(formatFigureValue({ value: 2.33, unit: "count" })).toBe("2.3");
    expect(formatAssumptionValue({ value: "They rise in step with the number of cars in stock", unit: "text" })).toBe("They rise in step with the number of cars in stock");
    expect(formatAssumptionValue({ value: 48000, unit: "gbp" })).toBe("£48,000");
    expect(formatAssumptionValue({ value: 60, unit: "days" })).toBe("60 days");
  });
});

describe("what the labels say", () => {
  it("names the four kinds of figure", () => {
    expect(FIGURE_KINDS.map(k => KIND_LABEL[k])).toEqual(["Known", "Inferred", "Predicted", "Unknown"]);
  });

  it("names where an assumption came from", () => {
    expect(SOURCE_LABEL).toEqual({ history: "Your history", boss: "Your figure", default: "Pilot's default" });
  });

  it("gives confidence as a word, never a percentage", () => {
    expect(CONFIDENCE_LABEL).toEqual({ low: "Low", medium: "Medium", high: "High" });
    for (const word of Object.values(CONFIDENCE_LABEL)) expect(word).not.toMatch(/[%\d]/);
  });
});

describe("the 'not a forecast' banner", () => {
  const note = "Simulation, not a forecast: arithmetic on your own recent history and the assumptions listed. Change an assumption and the answer changes.";

  it("shows the banner words as the heading and the rest of the note beneath", () => {
    expect(BANNER_TITLE).toBe("Simulation, not a forecast");
    expect(bannerBody(note)).toBe("arithmetic on your own recent history and the assumptions listed. Change an assumption and the answer changes.");
  });

  it("still says something plain when the note is missing or empty", () => {
    for (const missing of [undefined, "", "   "]) expect(bannerBody(missing)).toMatch(/^Arithmetic on your own recent history/);
  });

  it("shows a note that does not start with the banner words as it is", () => {
    expect(bannerBody("Some other note.")).toBe("Some other note.");
  });
});

describe("reading what Boss types into a box", () => {
  it("reads plain numbers, thousands separators and a £ sign", () => {
    expect(parseNumberField("50000")).toBe(50000);
    expect(parseNumberField("50,000")).toBe(50000);
    expect(parseNumberField("£50,000")).toBe(50000);
    expect(parseNumberField("  £ 1,000.50  ")).toBe(1000.5);
    expect(parseNumberField("0")).toBe(0);
    expect(parseNumberField("12.5")).toBe(12.5);
  });

  it("says a blank box is blank, and anything that is not a plain number is not a number", () => {
    expect(parseNumberField("")).toBeUndefined();
    expect(parseNumberField("   ")).toBeUndefined();
    expect(parseNumberField("£")).toBeUndefined();
    for (const bad of ["abc", "5,00", "1e3", "-5", "5 000", "50,00,000", "1,2345", ".5", "5.", "0x10", "Infinity", "NaN", "5k", "50000abc"]) {
      expect(parseNumberField(bad), bad).toBeNull();
    }
  });
});

describe("turning the boxes into a request, with the server's limits", () => {
  const stock = (amount: string) => buildRequest("stock_investment", { ...EMPTY_FIELDS, amount });
  const cut = (f: Partial<typeof EMPTY_FIELDS>) => buildRequest("price_cut_aged_stock", { ...EMPTY_FIELDS, ...f });

  it("accepts a stock amount from £1 to £1,000,000", () => {
    expect(stock("50,000")).toEqual({ ok: true, request: { kind: "stock_investment", params: { amountGbp: 50000 } } });
    expect(stock("1")).toMatchObject({ ok: true });
    expect(stock("1,000,000")).toMatchObject({ ok: true });
  });

  it("refuses a missing, zero, oversized or unreadable stock amount, in plain words", () => {
    for (const bad of ["", "0", "0.5", "1,000,001", "lots", "-5"]) {
      const r = stock(bad);
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.error, bad).toContain("How much would you put into stock");
    }
    const r = stock("2,000,000");
    if (!r.ok) expect(r.error).toContain("£1,000,000");
  });

  it("takes every price-cut box as optional, so blank boxes use the defaults", () => {
    expect(cut({})).toEqual({ ok: true, request: { kind: "price_cut_aged_stock", params: {} } });
  });

  it("sends only the boxes that were filled in", () => {
    expect(cut({ cut: "£750" })).toEqual({ ok: true, request: { kind: "price_cut_aged_stock", params: { cutGbp: 750 } } });
    expect(cut({ days: "90", cut: "700", extraSales: "4" })).toEqual({
      ok: true,
      request: { kind: "price_cut_aged_stock", params: { daysThreshold: 90, cutGbp: 700, extraSalesFromCut: 4 } },
    });
    // a guess of nothing is a real guess; a blank box is not one
    expect(cut({ extraSales: "0" })).toEqual({ ok: true, request: { kind: "price_cut_aged_stock", params: { extraSalesFromCut: 0 } } });
    expect(cut({ extraSales: "" })).toEqual({ ok: true, request: { kind: "price_cut_aged_stock", params: {} } });
  });

  it("keeps days between 7 and 365, the cut between £0 and £10,000, and extra sales between 0 and 500", () => {
    for (const ok of [{ days: "7" }, { days: "365" }, { cut: "0" }, { cut: "10,000" }, { extraSales: "0" }, { extraSales: "500" }]) expect(cut(ok), JSON.stringify(ok)).toMatchObject({ ok: true });
    for (const [bad, message] of [
      [{ days: "6" }, "Days in stock"],
      [{ days: "366" }, "Days in stock"],
      [{ days: "soon" }, "Days in stock"],
      [{ cut: "10,001" }, "The price cut"],
      [{ cut: "-1" }, "The price cut"],
      [{ extraSales: "501" }, "Extra cars sold by the cut"],
      [{ extraSales: "some" }, "Extra cars sold by the cut"],
    ] as const) {
      const r = cut(bad);
      expect(r.ok, JSON.stringify(bad)).toBe(false);
      if (!r.ok) expect(r.error, JSON.stringify(bad)).toContain(message);
    }
  });
});

describe("whether a result can be saved to a decision", () => {
  const now = Date.parse("2030-06-01T12:00:00Z");
  const sim = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}` })) as never;
  const boss = { optionKey: "a", reasoning: "", decidedAt: "2030-01-01T00:00:00Z", decidedByUserId: "u", decidedByName: "n" };
  const outcome = { recordedAt: "x", recordedByUserId: "u", recordedByName: "n", actuals: [], notes: "", lessons: { pilotRight: "", pilotWrong: "", bossRight: "", unexpected: "", lesson: "" } };

  it("can while the decision is open and holds fewer than the most it can", () => {
    expect(saveAvailability({ bossDecision: undefined, outcome: undefined, reviewDueAt: undefined, simulations: sim(0) }, now)).toEqual({ can: true });
    expect(saveAvailability({ bossDecision: undefined, outcome: undefined, reviewDueAt: undefined, simulations: sim(MAX_SIMULATIONS - 1) }, now)).toEqual({ can: true });
  });

  it("cannot once it holds the most it can, and says so", () => {
    const r = saveAvailability({ bossDecision: undefined, outcome: undefined, reviewDueAt: undefined, simulations: sim(MAX_SIMULATIONS) }, now);
    expect(r.can).toBe(false);
    if (!r.can) expect(r.reason).toContain(`already holds ${MAX_SIMULATIONS} simulations`);
  });

  it("cannot once Boss has decided, when it is due for review, or once an outcome is recorded", () => {
    for (const d of [
      { bossDecision: boss, outcome: undefined, reviewDueAt: undefined },
      { bossDecision: boss, outcome: undefined, reviewDueAt: "2030-05-01T00:00:00Z" },
      { bossDecision: boss, outcome, reviewDueAt: undefined },
      { bossDecision: undefined, outcome, reviewDueAt: undefined },
    ]) {
      const r = saveAvailability({ ...d, simulations: sim(0) }, now);
      expect(r.can, JSON.stringify(d)).toBe(false);
      if (!r.can) expect(r.reason).toContain("already been made");
    }
  });
});

describe("the date a simulation was run", () => {
  it("is written as a UK date", () => {
    expect(formatRunDate("2030-06-01T12:00:00Z")).toBe("1 Jun 2030");
    expect(formatRunDate("2030-12-25T09:30:00Z")).toBe("25 Dec 2030");
  });
  it("says so when the date cannot be read", () => {
    expect(formatRunDate("not a date")).toBe("date unknown");
  });
});
