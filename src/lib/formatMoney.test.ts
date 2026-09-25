import { describe, it, expect } from "vitest";
import { formatMoney } from "./formatMoney";

describe("formatMoney", () => {
  it("writes whole pounds with a thousands separator", () => {
    expect(formatMoney(65550)).toBe("£65,550");
    expect(formatMoney(750)).toBe("£750");
    expect(formatMoney(1234567)).toBe("£1,234,567");
    expect(formatMoney(0)).toBe("£0");
  });

  it("puts the minus sign before the pound sign, never after it", () => {
    expect(formatMoney(-14950)).toBe("-£14,950");
    expect(formatMoney(-14950)).not.toContain("£-");
    expect(formatMoney(-14950.5, { pence: true })).toBe("-£14,950.50");
  });

  it("rounds to the nearest pound, or shows pence when asked", () => {
    expect(formatMoney(1234.49)).toBe("£1,234");
    expect(formatMoney(1234.5)).toBe("£1,235");
    expect(formatMoney(1234.5, { pence: true })).toBe("£1,234.50");
    expect(formatMoney(7, { pence: true })).toBe("£7.00");
    expect(formatMoney(0.1 + 0.2, { pence: true })).toBe("£0.30");
  });

  it("shows pence only when there are some, when asked to decide", () => {
    // the dashboard used to print "£6,940.3": the trailing pence digit was lost
    expect(formatMoney(6940.3, { pence: "auto" })).toBe("£6,940.30");
    expect(formatMoney(7000, { pence: "auto" })).toBe("£7,000");
    expect(formatMoney(7000.004, { pence: "auto" })).toBe("£7,000");
    expect(formatMoney(-12.5, { pence: "auto" })).toBe("-£12.50");
    expect(formatMoney(0.1 + 0.2, { pence: "auto" })).toBe("£0.30");
  });

  it("never prints a negative zero", () => {
    expect(formatMoney(-0.2)).toBe("£0");
    expect(formatMoney(-0)).toBe("£0");
    expect(formatMoney(-0.004, { pence: true })).toBe("£0.00");
  });

  it("prints a dash, never NaN or undefined, for anything that isn't a number", () => {
    for (const bad of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(formatMoney(bad as number | null | undefined)).toBe("—");
      expect(formatMoney(bad as number | null | undefined, { pence: true })).toBe("—");
    }
  });
});
