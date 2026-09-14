import { describe, it, expect } from "vitest";
import { motAiEngine } from "./motAiEngine";

// Regression suite for the exact bug the user caught live: a vehicle
// with a genuinely expired MOT scored as perfectly healthy, because
// the engine only ever looked at advisory/failure counts and mileage —
// never the one fact that actually matters most, whether the current
// MOT has actually expired.

describe("motAiEngine — expired MOT overrides everything else", () => {
  it("a clean record with an expired MOT is high risk, not healthy", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const result = motAiEngine(
      { expiry: yesterday, advisories: [], failures: [] },
      [{ mileage: 20000 }] // low mileage, would otherwise score very healthy
    );
    expect(result.riskLevel).toBe("high");
    expect(result.healthScore).toBe(0);
  });

  it("a valid, future MOT with a clean record is genuinely low risk", () => {
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString();
    const result = motAiEngine(
      { expiry: nextYear, advisories: [], failures: [] },
      [{ mileage: 20000 }]
    );
    expect(result.riskLevel).toBe("low");
    expect(result.healthScore).toBeGreaterThan(70);
  });

  it("no expiry data at all doesn't fabricate an expired verdict", () => {
    const result = motAiEngine(
      { advisories: [], failures: [] }, // no expiry field
      [{ mileage: 20000 }]
    );
    expect(result.riskLevel).toBe("low");
  });

  it("expired status wins even with an otherwise perfect record — never silently overridden by low mileage", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const result = motAiEngine(
      { expiry: yesterday, advisories: [], failures: [] },
      [{ mileage: 500 }] // practically brand new
    );
    expect(result.riskLevel).toBe("high");
  });

  it("the verdict/nextTestRisk text is honest about being expired, not about a predicted future failure", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const result = motAiEngine({ expiry: yesterday, advisories: [], failures: [] }, []);
    expect(result.verdict.toLowerCase()).toContain("expired");
    expect(result.nextTestRisk.toLowerCase()).toContain("expired");
  });

  it("real advisories/failures still degrade health score when the MOT is still valid", () => {
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString();
    const clean = motAiEngine({ expiry: nextYear, advisories: [], failures: [] }, [{ mileage: 20000 }]);
    const withIssues = motAiEngine(
      { expiry: nextYear, advisories: ["a", "b"], failures: ["c"] },
      [{ mileage: 20000 }]
    );
    expect(withIssues.healthScore).toBeLessThan(clean.healthScore);
  });
});
