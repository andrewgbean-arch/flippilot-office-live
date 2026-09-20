import { describe, it, expect } from "vitest";
import type { Vehicle } from "@/types/Vehicle";
import { advisoryCount, averageDaysInStock, motCounts, unsoldCars } from "./stockFacts";

// "Now" is fixed so every date below means the same thing on any day.
const NOW = new Date("2026-09-20T12:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

// Only the fields these functions read; the rest of a Vehicle is irrelevant here.
function car(over: { id?: string; status?: string; createdAt?: string; expiry?: string | null; advisories?: unknown } = {}): Vehicle {
  return {
    id: over.id ?? "v",
    status: over.status ?? "in stock",
    ...(over.createdAt === undefined ? {} : { createdAt: over.createdAt }),
    mot: { expiry: over.expiry ?? "", advisories: over.advisories ?? [] },
  } as unknown as Vehicle;
}

describe("unsoldCars", () => {
  it("drops sold cars and keeps every other status, however the status is written", () => {
    const cars = [
      car({ id: "a", status: "in stock" }),
      car({ id: "b", status: "sold" }),
      car({ id: "c", status: "  Sold " }),
      car({ id: "d", status: "reserved" }),
      car({ id: "e", status: "" }),
    ];
    expect(unsoldCars(cars).map(c => c.id)).toEqual(["a", "d", "e"]);
  });
});

describe("motCounts", () => {
  it("sorts cars into expired, due within 30 days, valid and no date", () => {
    const cars = [
      car({ expiry: "2026-09-19" }), // ran out yesterday
      car({ expiry: "2025-01-01" }), // long gone
      car({ expiry: "2026-09-20" }), // valid through today: due soon
      car({ expiry: "2026-10-19" }), // 30 days left: still "due soon"
      car({ expiry: "2026-10-20" }), // 31 days left: valid
      car({ expiry: "2027-03-01" }),
      car({ expiry: "" }),
      car({ expiry: "not a date" }),
    ];
    expect(motCounts(cars, NOW)).toEqual({ expired: 2, dueSoon: 2, valid: 2, noDate: 2 });
  });

  it("counts a car with no MOT record at all as 'no date', not as fine and not as a crash", () => {
    // The server accepts a stored car with no `mot` object.
    const noMot = { id: "x", status: "in stock" } as unknown as Vehicle;
    expect(motCounts([noMot], NOW)).toEqual({ expired: 0, dueSoon: 0, valid: 0, noDate: 1 });
  });

  it("is all zeros for no cars", () => {
    expect(motCounts([], NOW)).toEqual({ expired: 0, dueSoon: 0, valid: 0, noDate: 0 });
  });
});

describe("averageDaysInStock", () => {
  it("averages whole days over the cars that have a date added", () => {
    expect(averageDaysInStock([car({ createdAt: daysAgo(10) }), car({ createdAt: daysAgo(30) })], NOW)).toEqual({
      average: 20,
      counted: 2,
    });
  });

  it("rounds to the nearest whole day, not up or down", () => {
    // 31 / 3 = 10.33 -> 10 (a ceiling would say 11); 21 / 2 = 10.5 -> 11 (a floor would say 10)
    expect(averageDaysInStock([10, 10, 11].map(d => car({ createdAt: daysAgo(d) })), NOW).average).toBe(10);
    expect(averageDaysInStock([10, 11].map(d => car({ createdAt: daysAgo(d) })), NOW).average).toBe(11);
  });

  it("leaves a car with no date out of the average and out of the count, rather than counting it as 0 days", () => {
    const result = averageDaysInStock([car({ createdAt: daysAgo(40) }), car()], NOW);
    expect(result).toEqual({ average: 40, counted: 1 });
  });

  it("gives null, not 0, when no car has a usable date", () => {
    expect(averageDaysInStock([car(), car({ createdAt: "garbage" })], NOW)).toEqual({ average: null, counted: 0 });
    expect(averageDaysInStock([], NOW)).toEqual({ average: null, counted: 0 });
  });
});

describe("advisoryCount", () => {
  it("counts the advisories on the current MOT, and 0 when there are none or the field is unreadable", () => {
    expect(advisoryCount(car({ advisories: ["Tyre worn", "Brake pad", "Oil leak"] }))).toBe(3);
    expect(advisoryCount(car({ advisories: [] }))).toBe(0);
    expect(advisoryCount(car({ advisories: "three" }))).toBe(0);
    expect(advisoryCount({} as unknown as Vehicle)).toBe(0);
  });
});
