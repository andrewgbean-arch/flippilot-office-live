import { describe, it, expect } from "vitest";
import { getUlezStatus } from "./ulezUtils";

describe("getUlezStatus", () => {
  it("returns unknown with no fuel type data at all", () => {
    expect(getUlezStatus(null, null).status).toBe("unknown");
    expect(getUlezStatus(undefined, undefined).status).toBe("unknown");
    expect(getUlezStatus("", "EURO 6").status).toBe("unknown");
  });

  it("treats electric and hydrogen as always compliant, even with no Euro standard", () => {
    expect(getUlezStatus("ELECTRICITY", null).status).toBe("compliant");
    expect(getUlezStatus("HYDROGEN", null).status).toBe("compliant");
  });

  it("returns unknown for a combustion vehicle with no Euro standard data", () => {
    expect(getUlezStatus("PETROL", null).status).toBe("unknown");
    expect(getUlezStatus("DIESEL", "").status).toBe("unknown");
  });

  describe("diesel — needs Euro 6+", () => {
    it("fails below Euro 6", () => {
      expect(getUlezStatus("DIESEL", "EURO 5").status).toBe("non-compliant");
      expect(getUlezStatus("DIESEL", "EURO 4").status).toBe("non-compliant");
    });

    it("passes at Euro 6 and above", () => {
      expect(getUlezStatus("DIESEL", "EURO 6").status).toBe("compliant");
      expect(getUlezStatus("DIESEL", "EURO 6").status).toBe("compliant");
    });

    it("handles the real DVLA response casing ('Euro 5', not 'EURO 5')", () => {
      expect(getUlezStatus("DIESEL", "Euro 5").status).toBe("non-compliant");
      expect(getUlezStatus("DIESEL", "Euro 6").status).toBe("compliant");
    });
  });

  describe("petrol/hybrid — needs Euro 4+", () => {
    it("fails below Euro 4", () => {
      expect(getUlezStatus("PETROL", "EURO 3").status).toBe("non-compliant");
      expect(getUlezStatus("PETROL", "EURO 1").status).toBe("non-compliant");
    });

    it("passes at Euro 4 and above", () => {
      expect(getUlezStatus("PETROL", "EURO 4").status).toBe("compliant");
      expect(getUlezStatus("PETROL", "EURO 6").status).toBe("compliant");
    });

    it("a hybrid is judged by its combustion engine's Euro standard, same as pure petrol", () => {
      expect(getUlezStatus("HYBRID ELECTRIC", "EURO 3").status).toBe("non-compliant");
      expect(getUlezStatus("HYBRID ELECTRIC", "EURO 4").status).toBe("compliant");
    });
  });

  it("returns unknown for an unrecognised fuel type rather than guessing compliant", () => {
    expect(getUlezStatus("LPG-ONLY-EXOTIC", "EURO 6").status).toBe("unknown");
  });

  it("never returns compliant for a real vehicle with no data — no fabricated pass", () => {
    // Regression guard for the exact failure mode this feature exists
    // to avoid: showing a confident "Yes" with nothing behind it.
    const result = getUlezStatus(undefined, undefined);
    expect(result.status).not.toBe("compliant");
    expect(result.status).not.toBe("non-compliant");
  });
});
