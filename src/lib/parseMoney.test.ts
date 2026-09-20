import { describe, it, expect } from "vitest";
import { readMoney, parseMoney, moneyProblem, isPositiveAmount, readOptionalMoney, MAX_MONEY, type MoneyProblem } from "./parseMoney";

// Hand-computed: every row is what a person would say the text means.
describe("parseMoney reads what a dealer types", () => {
  const good: [string, number][] = [
    ["4500", 4500],
    ["4,500", 4500],
    ["£4,500.50", 4500.5],
    ["£4500", 4500],
    ["  4500  ", 4500],
    ["\u00a0£4,500\u00a0", 4500], // a cell copied from a spreadsheet: non-breaking spaces
    ["£ 4,500", 4500],
    ["0", 0],
    ["0.5", 0.5],
    ["0.50", 0.5],
    ["12", 12],
    ["999", 999],
    ["1,000", 1000],
    ["12,345", 12345],
    ["12,345,678", 12345678],
    ["1,234,567.89", 1234567.89],
    ["4500.5", 4500.5],
    ["4500.05", 4500.05],
    ["4500.00", 4500],
    ["1000000000", MAX_MONEY],
  ];
  it.each(good)("%j is %d", (text, expected) => {
    expect(parseMoney(text)).toBe(expected);
    expect(readMoney(text)).toEqual({ ok: true, value: expected });
    expect(moneyProblem(text)).toBeNull();
  });

  it("takes a number that is already a number", () => {
    expect(parseMoney(4500)).toBe(4500);
    expect(parseMoney(4500.5)).toBe(4500.5);
    expect(parseMoney(0)).toBe(0);
  });
});

describe("parseMoney refuses what it cannot read, with a reason", () => {
  const bad: [string, MoneyProblem][] = [
    ["", "blank"],
    ["   ", "blank"],
    ["\u00a0", "blank"],
    ["£", "unreadable"],
    ["abc", "unreadable"],
    ["12abc", "unreadable"],
    ["£abc", "unreadable"],
    ["1e3", "unreadable"],
    ["1E3", "unreadable"],
    ["4.5e3", "unreadable"],
    ["Infinity", "unreadable"],
    ["-Infinity", "unreadable"],
    ["NaN", "unreadable"],
    ["0x1F", "unreadable"],
    ["0b101", "unreadable"],
    ["12 000", "unreadable"], // a space inside the number
    ["4 500.00", "unreadable"],
    ["+4500", "unreadable"],
    ["--5", "unreadable"],
    ["£-£5", "unreadable"],
    ["5.", "unreadable"],
    [".5", "unreadable"],
    ["1..2", "unreadable"],
    ["1.2.3", "unreadable"],
    ["007", "unreadable"], // a leading zero is a slip, not a value
    ["00", "unreadable"],
    ["(4500)", "unreadable"],
    ["4500p", "unreadable"],
    ["£4,500 ish", "unreadable"],
    // commas that are not thousands separators
    ["4,5", "commas"],
    ["1,23,456", "commas"],
    ["4500,50", "commas"],
    ["4,50", "commas"],
    [",500", "commas"],
    ["4,500,", "commas"],
    ["4,5000", "commas"],
    ["4,,500", "commas"],
    ["1234,567", "commas"],
    ["0,500", "commas"],
    ["£4,5", "commas"],
    // continental: dots for thousands, comma for pence
    ["4.500,00", "european"],
    ["4.500,5", "european"],
    ["1.234.567,89", "european"],
    ["1.234.567", "european"],
    ["4.500", "european"],
    ["£4.500,00", "european"],
    // more than pounds and pence
    ["4500.999", "pence"],
    ["4500.001", "pence"],
    ["0.005", "pence"],
    ["4500.0000", "pence"],
    // negatives are not accepted unless the caller allows them
    ["-100", "negative"],
    ["-£100", "negative"],
    ["£-100", "negative"],
    ["\u2212100", "negative"],
    ["- 100", "negative"],
    ["-0", "negative"],
    // too large / not exact
    ["1000000000.01", "too-large"],
    ["1000000001", "too-large"],
    ["9".repeat(30), "too-large"],
    ["9".repeat(400), "too-large"], // Number() of this is Infinity
  ];
  it.each(bad)("%j is refused (%s)", (text, reason) => {
    const read = readMoney(text);
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.reason).toBe(reason);
      expect(read.message.length).toBeGreaterThan(10);
    }
    expect(parseMoney(text)).toBeNull(); // never 0
    expect(moneyProblem(text)).not.toBeNull();
  });

  it("never answers 0 for something it could not read", () => {
    for (const [text] of bad) {
      const value = parseMoney(text);
      expect(value === 0, `${JSON.stringify(text)} came back as 0`).toBe(false);
    }
  });

  it("refuses things that are not text or numbers at all", () => {
    for (const thing of [{}, [], [4500], true, () => 1, Symbol.iterator]) {
      expect(parseMoney(thing as unknown)).toBeNull();
    }
    expect(readMoney(NaN)).toMatchObject({ ok: false, reason: "unreadable" });
    expect(readMoney(Infinity)).toMatchObject({ ok: false, reason: "unreadable" });
    expect(readMoney(-Infinity)).toMatchObject({ ok: false, reason: "unreadable" });
  });

  it("treats null and undefined as blank", () => {
    expect(readMoney(null)).toMatchObject({ ok: false, reason: "blank" });
    expect(readMoney(undefined)).toMatchObject({ ok: false, reason: "blank" });
  });

  it("refuses a number that would print in exponent form or carries float noise", () => {
    expect(readMoney(1e21)).toMatchObject({ ok: false }); // String(1e21) is "1e+21"
    expect(readMoney(0.1 + 0.2)).toMatchObject({ ok: false, reason: "pence" }); // 0.30000000000000004
  });
});

describe("the messages tell the dealer what to type", () => {
  it("asks for pounds for anything unreadable", () => {
    expect(moneyProblem("abc")).toContain("4500");
  });
  it("explains commas: thousands only, pence with a dot", () => {
    const m = moneyProblem("4,5")!;
    expect(m).toContain("Commas can only separate thousands");
    expect(m).toContain("4500.50");
  });
  it("names the European style and shows the fix", () => {
    const m = moneyProblem("4.500,00")!;
    expect(m).toContain("European");
    expect(m).toContain("4,500.00");
  });
  it("explains pence", () => {
    expect(moneyProblem("4500.999")).toContain("2 decimal places");
  });
  it("says no minus sign", () => {
    expect(moneyProblem("-5")).toContain("no minus sign");
  });
  it("says too large", () => {
    expect(moneyProblem("99999999999")).toContain("too large");
  });
  it("blank uses the caller's own words when given, and a plain default otherwise", () => {
    expect(moneyProblem("", { blankMessage: "Enter the sale price." })).toBe("Enter the sale price.");
    expect(moneyProblem("")).toBe("Enter an amount.");
    // a blankMessage never leaks into a different problem
    expect(moneyProblem("abc", { blankMessage: "Enter the sale price." })).not.toBe("Enter the sale price.");
  });
});

describe("options", () => {
  it("allowNegative accepts a minus sign in the usual places and returns a negative number", () => {
    const o = { allowNegative: true };
    expect(parseMoney("-250", o)).toBe(-250);
    expect(parseMoney("-£250", o)).toBe(-250);
    expect(parseMoney("£-250", o)).toBe(-250);
    expect(parseMoney("\u2212250", o)).toBe(-250);
    expect(parseMoney("- £1,250.50", o)).toBe(-1250.5);
    expect(parseMoney("250", o)).toBe(250);
  });

  it("allowNegative still refuses a bad number, and never returns negative zero", () => {
    expect(parseMoney("-abc", { allowNegative: true })).toBeNull();
    expect(parseMoney("-4,5", { allowNegative: true })).toBeNull();
    expect(Object.is(parseMoney("-0", { allowNegative: true }), 0)).toBe(true);
    expect(Object.is(parseMoney("-0.00", { allowNegative: true }), 0)).toBe(true);
  });

  it("positive refuses zero and says so", () => {
    expect(readMoney("0", { positive: true })).toMatchObject({ ok: false, reason: "not-positive" });
    expect(readMoney("0.00", { positive: true })).toMatchObject({ ok: false, reason: "not-positive" });
    expect(moneyProblem("0", { positive: true })).toContain("greater than £0");
    expect(parseMoney("0", { positive: true })).toBeNull();
    expect(parseMoney("0.01", { positive: true })).toBe(0.01);
    expect(parseMoney("1", { positive: true })).toBe(1);
  });

  it("positive plus allowNegative still refuses a negative amount", () => {
    expect(parseMoney("-5", { positive: true, allowNegative: true })).toBeNull();
    expect(readMoney("-5", { positive: true, allowNegative: true })).toMatchObject({ reason: "not-positive" });
  });

  it("without positive, zero is a real value (a typed 0 is not the same as blank)", () => {
    expect(readMoney("0")).toEqual({ ok: true, value: 0 });
    expect(readMoney("")).toMatchObject({ ok: false, reason: "blank" });
  });
});

describe("isPositiveAmount: is a STORED number a usable price", () => {
  it("accepts finite numbers above zero", () => {
    for (const n of [0.01, 1, 4500, 1e9]) expect(isPositiveAmount(n)).toBe(true);
  });
  it("refuses zero, negatives, NaN, infinities, null, undefined, strings", () => {
    for (const n of [0, -0, -1, NaN, Infinity, -Infinity, null, undefined, "4500", {}, []]) {
      expect(isPositiveAmount(n), String(n)).toBe(false);
    }
  });
});

describe("readOptionalMoney: an optional stock price is unset, never 0", () => {
  it("blank is null, not 0", () => {
    for (const blank of ["", "   ", null, undefined]) {
      expect(readOptionalMoney(blank)).toEqual({ ok: true, value: null });
    }
  });

  it("a typed 0 is unset too (a stock car is never priced at nothing)", () => {
    expect(readOptionalMoney("0")).toEqual({ ok: true, value: null });
    expect(readOptionalMoney("0.00")).toEqual({ ok: true, value: null });
    expect(readOptionalMoney("£0")).toEqual({ ok: true, value: null });
  });

  it("a real price comes back as the number", () => {
    expect(readOptionalMoney("7,250")).toEqual({ ok: true, value: 7250 });
    expect(readOptionalMoney("£7,250.50")).toEqual({ ok: true, value: 7250.5 });
    expect(readOptionalMoney(" 0.01 ")).toEqual({ ok: true, value: 0.01 });
  });

  it("something typed but unreadable is refused with its reason, never quietly dropped to null", () => {
    expect(readOptionalMoney("7,25")).toMatchObject({ ok: false, reason: "commas" });
    expect(readOptionalMoney("abc")).toMatchObject({ ok: false, reason: "unreadable" });
    expect(readOptionalMoney("-5")).toMatchObject({ ok: false, reason: "negative" });
    expect(readOptionalMoney("4.500,00")).toMatchObject({ ok: false, reason: "european" });
    expect(readOptionalMoney("7250.999")).toMatchObject({ ok: false, reason: "pence" });
    expect(readOptionalMoney("99999999999")).toMatchObject({ ok: false, reason: "too-large" });
  });
});
