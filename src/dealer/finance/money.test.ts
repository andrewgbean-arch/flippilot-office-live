import { describe, it, expect } from "vitest";
import { formatWholePounds } from "./money";

describe("formatWholePounds", () => {
  it("rounds to the pound and groups thousands", () => {
    expect(formatWholePounds(8550)).toBe("£8,550");
    expect(formatWholePounds(8549.6)).toBe("£8,550");
    expect(formatWholePounds(1234567.2)).toBe("£1,234,567");
  });

  it("puts the minus sign before the £ and never prints -£0", () => {
    expect(formatWholePounds(-2040.4)).toBe("-£2,040");
    expect(formatWholePounds(-0.2)).toBe("£0");
    expect(formatWholePounds(0)).toBe("£0");
  });
});
