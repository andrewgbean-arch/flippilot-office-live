import { describe, it, expect } from "vitest";
import { motAiEngine, isMotExpired, hasMotData, MOT_RULE_OF_THUMB } from "./motAiEngine";
import { motState } from "@/dealer/inventory/vehicleListModel";

// Regression suite for the exact bug the user caught live: a vehicle
// with a genuinely expired MOT scored as perfectly healthy, because
// the engine only ever looked at advisory/failure counts and mileage —
// never the one fact that actually matters most, whether the current
// MOT has actually expired.

describe("motAiEngine — expired MOT overrides everything else", () => {
  it("a clean record with an expired MOT is high risk, not healthy", () => {
    const yesterday = new Date(Date.now() - 2 * 86400000).toISOString();
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

  it("expired status wins even with an otherwise perfect record — never silently overridden by low mileage", () => {
    const yesterday = new Date(Date.now() - 2 * 86400000).toISOString();
    const result = motAiEngine(
      { expiry: yesterday, advisories: [], failures: [] },
      [{ mileage: 500 }] // practically brand new
    );
    expect(result.riskLevel).toBe("high");
  });

  it("the verdict/nextTestRisk text is honest about being expired, not about a predicted future failure", () => {
    const yesterday = new Date(Date.now() - 2 * 86400000).toISOString();
    const result = motAiEngine({ expiry: yesterday, advisories: [], failures: [] }, []);
    expect(result.verdict.toLowerCase()).toContain("expired");
    expect(result.nextTestRisk.toLowerCase()).toContain("expired");
  });

  it("an expired MOT has no pass chance to quote: it needs a test, it has not failed one", () => {
    const yesterday = new Date(Date.now() - 2 * 86400000).toISOString();
    const result = motAiEngine({ expiry: yesterday, advisories: [] }, []);
    expect(result.predictedPassChance).toBeNull();
    expect(result.passOutlook).toBeNull();
    expect(result.basis.expired).toBe(true);
  });

  it("real advisories and failed tests still degrade the health score when the MOT is still valid", () => {
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString();
    const clean = motAiEngine({ expiry: nextYear, advisories: [] }, [{ mileage: 20000 }]);
    const withIssues = motAiEngine(
      { expiry: nextYear, advisories: ["a", "b"] },
      [{ mileage: 20000 }, { date: "2023-01-10T10:00:00.000Z", result: "FAIL", failures: ["c"], mileage: 15000 }]
    );
    expect(withIssues.healthScore!).toBeLessThan(clean.healthScore!);
  });
});

describe("motAiEngine — the day the MOT expires is still valid", () => {
  const NOON = Date.UTC(2026, 8, 20, 12, 0, 0);

  it("a date-only expiry is not expired on the day itself, and is expired the day after", () => {
    expect(isMotExpired("2026-09-20", NOON)).toBe(false);
    expect(isMotExpired("2026-09-19", NOON)).toBe(true);
    expect(isMotExpired("2026-09-21", NOON)).toBe(false);
  });

  it("blank or unreadable expiries are never reported as expired", () => {
    expect(isMotExpired("", NOON)).toBe(false);
    expect(isMotExpired("   ", NOON)).toBe(false);
    expect(isMotExpired(null, NOON)).toBe(false);
    expect(isMotExpired(undefined, NOON)).toBe(false);
    expect(isMotExpired("not a date", NOON)).toBe(false);
  });

  it("the engine treats an MOT expiring today as valid", () => {
    const r = motAiEngine({ expiry: "2026-09-20", advisories: [] }, [{ mileage: 30000 }], NOON);
    expect(r.basis.expired).toBe(false);
    expect(r.healthScore).toBeGreaterThan(0);
  });
});

describe("motAiEngine — no MOT data is not good news", () => {
  const empties: Array<[string, any, any[]]> = [
    ["undefined record and no history", undefined, []],
    ["the blank record a new car is created with", { expiry: "", advisories: [], historyScore: 0, history: [], mileage: null }, []],
    ["an empty object", {}, []],
    ["a bare current-mileage reading and nothing else (what the intelligence provider passes)", { expiry: null, advisories: [], failures: [] }, [{ mileage: 90000 }]],
    ["blank expiry with an empty history array on the record", { expiry: "   ", advisories: [], history: [] }, []],
  ];

  for (const [label, mot, history] of empties) {
    it(`${label}: no invented health score or pass chance`, () => {
      const r = motAiEngine(mot, history);
      expect(r.hasData).toBe(false);
      expect(r.healthScore).toBeNull();
      expect(r.predictedPassChance).toBeNull();
      expect(r.passOutlook).toBeNull();
      expect(r.mileageRisk).toBeNull();
      expect(r.riskLevel).toBe("unknown");
      expect(r.summary).toBe("No MOT data is recorded for this vehicle.");
      expect(r.verdict.toLowerCase()).toContain("no mot data");
      // ...and never the old "healthy, no critical issues" claim.
      expect(r.verdict.toLowerCase()).not.toContain("healthy");
      expect(r.nextTestRisk.toLowerCase()).not.toContain("strong chance");
    });
  }

  it("reports zero facts in the basis so nothing can be read as a real count", () => {
    const r = motAiEngine({}, []);
    expect(r.basis).toEqual({
      testsRecorded: 0, failedTests: 0, failureItems: 0, advisories: 0, latestTest: null, mileage: null, expiry: null, expired: false,
    });
  });

  it("any real record counts as data: an expiry date, a test in the history, or an advisory", () => {
    const future = new Date(Date.now() + 200 * 86400000).toISOString();
    expect(motAiEngine({ expiry: future }, []).hasData).toBe(true);
    expect(motAiEngine({}, [{ date: "2024-03-01T09:00:00.000Z", result: "PASS", mileage: 40000 }]).hasData).toBe(true);
    expect(motAiEngine({ advisories: ["Tyre worn"] }, []).hasData).toBe(true);
  });

  it("a real record never comes back with the 'unknown' risk level", () => {
    const future = new Date(Date.now() + 200 * 86400000).toISOString();
    expect(motAiEngine({ expiry: future, advisories: [] }, []).riskLevel).not.toBe("unknown");
  });
});

describe("motAiEngine — failures come from the test history", () => {
  const future = new Date(Date.now() + 200 * 86400000).toISOString();

  // The audit's case: 4 tests, 5 recorded failure items, 120k miles.
  // The old engine read a field that does not exist and answered 95 "low".
  const auditHistory = [
    { date: "2025-10-02T10:00:00.000Z", result: "PASS", mileage: 120000, failures: [], advisories: ["Tyre worn"] },
    { date: "2025-09-28T10:00:00.000Z", result: "FAIL", mileage: 119900, failures: ["Brake pad", "Headlamp aim", "Wiper blade"], advisories: [] },
    { date: "2024-10-01T10:00:00.000Z", result: "FAIL", mileage: 108000, failures: ["Exhaust", "Tyre"], advisories: [] },
    { date: "2023-10-01T10:00:00.000Z", result: "PASS", mileage: 96000, failures: [], advisories: [] },
  ];

  it("counts every failure item on record and no longer scores such a car as healthy", () => {
    const r = motAiEngine({ expiry: future, advisories: ["Tyre worn"], history: auditHistory }, auditHistory);
    expect(r.basis.failureItems).toBe(5);
    expect(r.basis.failedTests).toBe(2);
    expect(r.basis.testsRecorded).toBe(4);
    expect(r.failureSeverity).toBe(100);
    expect(r.healthScore!).toBeLessThan(50); // the old engine said 95
    expect(r.riskLevel).not.toBe("low");
  });

  it("a car with recorded failures scores below the same car with none", () => {
    const clean = auditHistory.map((h) => ({ ...h, result: "PASS", failures: [] as string[] }));
    const failed = motAiEngine({ expiry: future, advisories: [] }, auditHistory);
    const passed = motAiEngine({ expiry: future, advisories: [] }, clean);
    expect(failed.healthScore!).toBeLessThan(passed.healthScore!);
    expect(passed.basis.failureItems).toBe(0);
  });

  it("a failed test with no items listed still counts as one failure", () => {
    const r = motAiEngine({ expiry: future }, [{ date: "2024-05-01T09:00:00.000Z", result: "FAIL", mileage: 50000 }]);
    expect(r.basis.failedTests).toBe(1);
    expect(r.basis.failureItems).toBe(1);
  });

  it("failure items are read from the history, not from a top-level mot.failures field", () => {
    const r = motAiEngine({ expiry: future, advisories: [], failures: ["x", "y", "z"] }, []);
    expect(r.basis.failureItems).toBe(0);
  });

  it("passing tests with no failures add nothing", () => {
    const r = motAiEngine({ expiry: future }, [
      { date: "2025-01-01T09:00:00.000Z", result: "PASS", failures: [], mileage: 30000 },
      { date: "2024-01-01T09:00:00.000Z", result: "PASS", failures: [], mileage: 20000 },
    ]);
    expect(r.basis.failureItems).toBe(0);
    expect(r.basis.failedTests).toBe(0);
  });

  it("the same objects passed as both mot.history and the history argument are counted once", () => {
    const withBoth = motAiEngine({ expiry: future, history: auditHistory }, auditHistory);
    const argOnly = motAiEngine({ expiry: future }, auditHistory);
    expect(withBoth.basis.failureItems).toBe(argOnly.basis.failureItems);
    expect(withBoth.healthScore).toBe(argOnly.healthScore);
  });

  it("reads mot.history when the history argument is empty", () => {
    const r = motAiEngine({ expiry: future, history: auditHistory }, []);
    expect(r.basis.failureItems).toBe(5);
  });
});

describe("motAiEngine — latest mileage is the newest test by date, never by position", () => {
  const future = new Date(Date.now() + 200 * 86400000).toISOString();
  const newestFirst = [
    { date: "2025-06-01T10:00:00.000Z", result: "PASS", mileage: 125000 },
    { date: "2023-06-01T10:00:00.000Z", result: "PASS", mileage: 80000 },
    { date: "2019-06-01T10:00:00.000Z", result: "PASS", mileage: 20000 },
  ];

  it("takes the mileage of the newest test from a newest-first list (the shape DVSA returns)", () => {
    const r = motAiEngine({ expiry: future }, newestFirst);
    expect(r.basis.mileage).toBe(125000);
    expect(r.mileageRisk).toBe(70); // the > 120,000 band; the oldest test would have said 15
  });

  it("gives the same answer whichever way round the list is stored", () => {
    const oldestFirst = [...newestFirst].reverse();
    const shuffled = [newestFirst[1], newestFirst[2], newestFirst[0]];
    const a = motAiEngine({ expiry: future }, newestFirst);
    const b = motAiEngine({ expiry: future }, oldestFirst);
    const c = motAiEngine({ expiry: future }, shuffled);
    expect(b.basis.mileage).toBe(125000);
    expect(c.basis.mileage).toBe(125000);
    expect(b.healthScore).toBe(a.healthScore);
    expect(c.healthScore).toBe(a.healthScore);
    expect(b.basis.latestTest?.date).toBe("2025-06-01T10:00:00.000Z");
  });

  it("uses the newest test that actually recorded a mileage", () => {
    const r = motAiEngine({ expiry: future }, [
      { date: "2025-06-01T10:00:00.000Z", result: "PASS", mileage: null },
      { date: "2023-06-01T10:00:00.000Z", result: "PASS", mileage: 80000 },
    ]);
    expect(r.basis.mileage).toBe(80000);
  });

  it("falls back to the year when a test has no date", () => {
    const r = motAiEngine({ expiry: future }, [
      { year: 2018, result: "PASS", mileage: 30000 },
      { year: 2024, result: "PASS", mileage: 95000 },
    ]);
    expect(r.basis.mileage).toBe(95000);
  });

  it("a bare current-mileage reading (no date) is used when it is higher than the newest test", () => {
    const r = motAiEngine({ expiry: future }, [{ mileage: 140000 }, ...newestFirst]);
    expect(r.basis.mileage).toBe(140000);
  });

  it("with no mileage anywhere it stays unknown instead of counting as brand new", () => {
    const r = motAiEngine({ expiry: future, advisories: [] }, []);
    expect(r.basis.mileage).toBeNull();
    expect(r.mileageRisk).toBeNull();
  });

  it("falls back to the record's own mileage when the history has none", () => {
    const r = motAiEngine({ expiry: future, mileage: 65000 }, []);
    expect(r.basis.mileage).toBe(65000);
    expect(r.mileageRisk).toBe(30);
  });

  it("does not reorder or change the list it is given", () => {
    const copy = JSON.parse(JSON.stringify(newestFirst));
    motAiEngine({ expiry: future, history: newestFirst }, newestFirst);
    expect(newestFirst).toEqual(copy);
  });

  it("reports the newest test by date as the latest test", () => {
    const r = motAiEngine({ expiry: future }, [
      { date: "2021-01-01T10:00:00.000Z", result: "PASS", mileage: 50000 },
      { date: "2024-01-12T10:00:00.000Z", result: "FAIL", mileage: 70000, failures: ["Brake"] },
      { date: "2022-01-01T10:00:00.000Z", result: "PASS", mileage: 60000 },
    ]);
    expect(r.basis.latestTest).toEqual({ date: "2024-01-12T10:00:00.000Z", result: "FAIL", mileage: 70000 });
  });
});

describe("motAiEngine — the pass chance is a rough band, not a probability", () => {
  const future = new Date(Date.now() + 200 * 86400000).toISOString();

  it("a clean, low-mileage car is a 'good' outlook and a poor record is a 'poor' one", () => {
    const good = motAiEngine({ expiry: future, advisories: [] }, [{ mileage: 20000 }]);
    expect(good.passOutlook).toBe("good");
    expect(good.predictedPassChance).toBe(97);

    const poor = motAiEngine(
      { expiry: future, advisories: ["a", "b", "c", "d", "e"] },
      [{ date: "2025-01-01T10:00:00.000Z", result: "FAIL", failures: ["1", "2", "3", "4", "5"], mileage: 190000 }]
    );
    expect(poor.passOutlook).toBe("poor");
    expect(poor.riskLevel).toBe("high");
  });

  it("only ever takes the six coarse steps", () => {
    const seen = new Set<number>();
    for (let fails = 0; fails <= 6; fails++) {
      for (let adv = 0; adv <= 10; adv += 2) {
        for (const miles of [10000, 70000, 100000, 130000, 160000, 200000]) {
          const r = motAiEngine(
            { expiry: future, advisories: Array(adv).fill("a") },
            [{ date: "2025-01-01T10:00:00.000Z", result: fails ? "FAIL" : "PASS", failures: Array(fails).fill("f"), mileage: miles }]
          );
          seen.add(r.predictedPassChance as number);
        }
      }
    }
    for (const v of seen) expect([97, 90, 78, 62, 45, 25]).toContain(v);
  });
});

describe("motAiEngine — the summary says what the rule was worked out from", () => {
  const future = new Date(Date.now() + 200 * 86400000).toISOString();

  it("names the advisories, failures and mileage it used", () => {
    const r = motAiEngine(
      { expiry: future, advisories: ["Tyre worn", "Oil leak"] },
      [
        { date: "2025-01-01T10:00:00.000Z", result: "PASS", mileage: 87000, failures: [] },
        { date: "2024-01-01T10:00:00.000Z", result: "FAIL", mileage: 80000, failures: ["Brake pad"] },
      ]
    );
    expect(r.summary).toContain("2 current advisories");
    expect(r.summary).toContain("1 failure item across 1 failed test (of 2 on record)");
    expect(r.summary).toContain("87,000 miles");
    expect(r.summary.toLowerCase()).toContain("rule of thumb");
  });

  it("says so when the MOT has expired", () => {
    const r = motAiEngine({ expiry: "2020-01-01", advisories: [] }, []);
    expect(r.summary.toLowerCase()).toContain("expired");
  });
});

describe("hasMotData", () => {
  it("is the same test the engine uses for hasData", () => {
    const future = new Date(Date.now() + 200 * 86400000).toISOString();
    const cases: Array<[any, any[]]> = [
      [undefined, []],
      [{}, []],
      [{ expiry: "", advisories: [], history: [] }, []],
      [{ expiry: null }, [{ mileage: 50000 }]],
      [{ expiry: future }, []],
      [{ advisories: ["x"] }, []],
      [{}, [{ date: "2024-01-01T00:00:00.000Z", result: "PASS" }]],
    ];
    for (const [mot, history] of cases) {
      expect(hasMotData(mot, history)).toBe(motAiEngine(mot, history).hasData);
    }
  });
});

describe("motAiEngine — the printed rule of thumb matches the arithmetic", () => {
  const future = new Date(Date.now() + 200 * 86400000).toISOString();
  const lowMiles = [{ mileage: 10000 }];

  it("each current advisory takes 3.5 off (10 advisories = 35)", () => {
    const none = motAiEngine({ expiry: future, advisories: [] }, lowMiles).healthScore!;
    const ten = motAiEngine({ expiry: future, advisories: Array(10).fill("a") }, lowMiles).healthScore!;
    expect(Math.abs(none - ten - 35)).toBeLessThanOrEqual(1);
  });

  it("failure items take about 14 off each, up to 65", () => {
    const test = (n: number) => [{ date: "2025-01-01T10:00:00.000Z", result: "FAIL", failures: Array(n).fill("f"), mileage: 10000 }];
    const none = motAiEngine({ expiry: future }, [{ date: "2025-01-01T10:00:00.000Z", result: "PASS", mileage: 10000 }]).healthScore!;
    const one = motAiEngine({ expiry: future }, test(1)).healthScore!;
    const five = motAiEngine({ expiry: future }, test(5)).healthScore!;
    const nine = motAiEngine({ expiry: future }, test(9)).healthScore!;
    // Scores are rounded to whole numbers, so allow one point either way.
    expect(Math.abs(none - one - 14)).toBeLessThanOrEqual(1);
    expect(Math.abs(none - five - 65)).toBeLessThanOrEqual(1);
    expect(five).toBe(nine); // capped at 65
  });

  it("mileage takes up to 24 off", () => {
    const low = motAiEngine({ expiry: future }, [{ mileage: 10000 }]).healthScore!; // band 5 -> 1.25
    const high = motAiEngine({ expiry: future }, [{ mileage: 200000 }]).healthScore!; // band 95 -> 23.75
    expect(Math.abs(low - high - 22.5)).toBeLessThanOrEqual(1);
    expect(MOT_RULE_OF_THUMB).toContain("3.5");
    expect(MOT_RULE_OF_THUMB).toContain("14");
    expect(MOT_RULE_OF_THUMB).toContain("24");
    expect(MOT_RULE_OF_THUMB.toLowerCase()).toContain("not a prediction");
  });
});

describe("isMotExpired agrees with the vehicle list's motState", () => {
  it("gives the same expired / not expired answer for a spread of expiry dates and moments", () => {
    const now = Date.UTC(2026, 8, 20, 12, 0, 0);
    const expiries = ["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2027-03-01", "2025-01-01", "2026-09-20T00:00:00.000Z", "2026-09-20T13:00:00.000Z", "2026-09-20T11:00:00.000Z"];
    for (const e of expiries) {
      expect(isMotExpired(e, now)).toBe(motState(e, new Date(now)).kind === "expired");
    }
  });
});
