import { describe, it, expect } from "vitest";
import { formatPounds } from "./money";

describe("formatPounds", () => {
  it("writes whole pounds with a comma, and keeps both pence digits", () => {
    expect(formatPounds(65550)).toBe("£65,550");
    expect(formatPounds(6940.3)).toBe("£6,940.30");
    expect(formatPounds(8123.333)).toBe("£8,123.33");
  });

  it("puts a minus sign before the pound sign and never prints minus nothing", () => {
    expect(formatPounds(-300)).toBe("-£300");
    expect(formatPounds(-0.001)).toBe("£0");
  });

  it("never prints NaN", () => {
    expect(formatPounds(Number.NaN)).toBe("an unknown amount");
  });
});
