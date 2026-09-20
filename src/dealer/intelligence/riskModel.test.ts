import { describe, it, expect } from "vitest";
import type { Vehicle } from "@/types/Vehicle";
import { computeRiskModel, MANY_ADVISORIES } from "./riskModel";

const NOW = new Date("2026-09-20T12:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

let nextId = 0;
function car(over: {
  make?: string;
  model?: string;
  status?: string;
  expiry?: string;
  advisories?: number;
  createdAt?: string;
} = {}): Vehicle {
  return {
    id: `car-${++nextId}`,
    make: over.make ?? "Ford",
    model: over.model ?? "Fiesta",
    status: over.status ?? "in stock",
    ...(over.createdAt === undefined ? {} : { createdAt: over.createdAt }),
    mot: {
      // valid for a long time unless a test says otherwise
      expiry: over.expiry ?? "2027-09-01",
      advisories: Array.from({ length: over.advisories ?? 0 }, (_, i) => `Advisory ${i + 1}`),
    },
  } as unknown as Vehicle;
}

describe("computeRiskModel", () => {
  it("is empty and honest for no stock: zero counts, no rows, nothing to load", () => {
    const m = computeRiskModel([], NOW);
    expect(m).toEqual({
      inStock: 0,
      mot: { expired: 0, dueSoon: 0, valid: 0, noDate: 0 },
      manyAdvisories: 0,
      ageing: 0,
      ageUnknown: 0,
      rows: [],
    });
  });

  it("offers counts only: no overall risk %, market volatility or stock stability", () => {
    expect(Object.keys(computeRiskModel([car()], NOW)).sort()).toEqual(
      ["ageUnknown", "ageing", "inStock", "manyAdvisories", "mot", "rows"]
    );
  });

  it("counts MOT expired, due within 30 days and no date, as three separate things", () => {
    const m = computeRiskModel(
      [car({ expiry: "2026-09-01" }), car({ expiry: "2026-10-01" }), car({ expiry: "" }), car({ expiry: "2027-09-01" })],
      NOW
    );
    expect(m.mot).toEqual({ expired: 1, dueSoon: 1, noDate: 1, valid: 1 });
  });

  it("flags 3 or more advisories, and not 2", () => {
    expect(MANY_ADVISORIES).toBe(3);
    const m = computeRiskModel([car({ advisories: 2 }), car({ advisories: 3 }), car({ advisories: 7 })], NOW);
    expect(m.manyAdvisories).toBe(2);
  });

  it("counts cars in stock 90 days or more, and says how many have no date so cannot be aged", () => {
    const m = computeRiskModel(
      [
        car({ createdAt: daysAgo(89) }),
        car({ createdAt: daysAgo(90) }),
        car({ createdAt: daysAgo(400) }),
        car(), // no date added
      ],
      NOW
    );
    expect(m.ageing).toBe(2);
    expect(m.ageUnknown).toBe(1);
  });

  it("leaves sold cars out of every count", () => {
    const m = computeRiskModel(
      [car({ status: "sold", expiry: "2020-01-01", advisories: 9, createdAt: daysAgo(900) }), car()],
      NOW
    );
    expect(m.inStock).toBe(1);
    expect(m.mot.expired).toBe(0);
    expect(m.manyAdvisories).toBe(0);
    expect(m.ageing).toBe(0);
    expect(m.rows).toEqual([]);
  });

  it("lists only cars with something to look at, with plain reasons", () => {
    const m = computeRiskModel(
      [
        car({ make: "Vauxhall", model: "Corsa", expiry: "2026-09-10", advisories: 4, createdAt: daysAgo(120) }),
        car({ make: "Kia", model: "Rio" }), // nothing wrong
      ],
      NOW
    );
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0]).toMatchObject({ title: "Vauxhall Corsa" });
    expect(m.rows[0]?.flags).toEqual(["MOT expired 10 days ago", "4 advisories on the MOT", "120 days in stock"]);
  });

  it("says 'No MOT date recorded' rather than treating a missing date as fine", () => {
    const m = computeRiskModel([car({ expiry: "" })], NOW);
    expect(m.rows[0]?.flags).toEqual(["No MOT date recorded"]);
  });

  it("puts the most urgent cars first: expired, then due soon, then no date, then advisories, then age", () => {
    const m = computeRiskModel(
      [
        car({ model: "AgeOnly", createdAt: daysAgo(200) }),
        car({ model: "AdvOnly", advisories: 5 }),
        car({ model: "NoDate", expiry: "" }),
        car({ model: "Soon", expiry: "2026-10-01" }),
        car({ model: "Expired", expiry: "2026-09-01" }),
      ],
      NOW
    );
    expect(m.rows.map(r => r.title)).toEqual([
      "Ford Expired",
      "Ford Soon",
      "Ford NoDate",
      "Ford AdvOnly",
      "Ford AgeOnly",
    ]);
  });

  it("breaks a tie by the number of reasons, then by name", () => {
    const m = computeRiskModel(
      [
        car({ model: "B", expiry: "2026-09-01" }),
        car({ model: "A", expiry: "2026-09-01" }),
        car({ model: "C", expiry: "2026-09-01", advisories: 4 }),
      ],
      NOW
    );
    expect(m.rows.map(r => r.title)).toEqual(["Ford C", "Ford A", "Ford B"]);
  });
});
