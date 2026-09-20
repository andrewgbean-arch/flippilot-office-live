import { describe, it, expect } from "vitest";
import type { Vehicle } from "@/types/Vehicle";
import { computeDealerHudStats, hudPills, hudSummaryLine, type DealerHudStats } from "./dealerHudStats";

// The snapshot bar shows counts from the dealer's own stock and nothing else:
// no market trend, FlipScore or risk level (those were invented; see the
// comment in dealerHudStats.ts). These tests pin that, and the wording.

const NOW = new Date("2026-09-20T12:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

let nextId = 0;
function car(over: { status?: string; createdAt?: string; expiry?: string } = {}): Vehicle {
  return {
    id: `car-${++nextId}`,
    status: over.status ?? "in stock",
    ...(over.createdAt === undefined ? {} : { createdAt: over.createdAt }),
    mot: { expiry: over.expiry ?? "", advisories: [] },
  } as unknown as Vehicle;
}

const stats = (over: Partial<DealerHudStats> = {}): DealerHudStats => ({
  inStock: 5,
  avgDaysInStock: 34,
  daysCounted: 5,
  motExpired: 0,
  motDueSoon: 0,
  motNoDate: 0,
  ...over,
});

describe("computeDealerHudStats", () => {
  it("for no cars is honest zeros and a null average, never a made-up figure", () => {
    expect(computeDealerHudStats([], NOW)).toEqual({
      inStock: 0,
      avgDaysInStock: null,
      daysCounted: 0,
      motExpired: 0,
      motDueSoon: 0,
      motNoDate: 0,
    });
  });

  it("reports only what can be counted: no market trend, FlipScore, risk level or sync state", () => {
    const keys = Object.keys(computeDealerHudStats([car()], NOW)).sort();
    expect(keys).toEqual(["avgDaysInStock", "daysCounted", "inStock", "motDueSoon", "motExpired", "motNoDate"]);
  });

  it("counts cars in stock, their average days, and their MOT position", () => {
    // Each MOT group has a different size (1, 2 and 3), so a figure put under
    // the wrong heading cannot pass by coincidence.
    const cars = [
      car({ createdAt: daysAgo(10), expiry: "2026-09-19" }), // expired
      car({ createdAt: daysAgo(30), expiry: "2026-10-01" }), // due within 30 days
      car({ createdAt: daysAgo(20), expiry: "2026-10-10" }), // due within 30 days
      car({ createdAt: daysAgo(40) }), // no MOT date
      car({ createdAt: daysAgo(50) }), // no MOT date
      car({ createdAt: daysAgo(60) }), // no MOT date
      car({ createdAt: daysAgo(20), expiry: "2027-06-01" }), // fine
    ];
    expect(computeDealerHudStats(cars, NOW)).toEqual({
      inStock: 7,
      avgDaysInStock: 33, // 230 / 7 = 32.86
      daysCounted: 7,
      motExpired: 1,
      motDueSoon: 2,
      motNoDate: 3,
    });
  });

  it("leaves sold cars out of every figure: a sold car with an expired MOT does not turn the bar red", () => {
    const cars = [
      car({ createdAt: daysAgo(10), expiry: "2027-06-01" }),
      car({ status: "sold", createdAt: daysAgo(400), expiry: "2020-01-01" }),
    ];
    expect(computeDealerHudStats(cars, NOW)).toEqual({
      inStock: 1,
      avgDaysInStock: 10,
      daysCounted: 1,
      motExpired: 0,
      motDueSoon: 0,
      motNoDate: 0,
    });
  });

  it("says how many cars the average covers when some have no date added", () => {
    const result = computeDealerHudStats([car({ createdAt: daysAgo(20) }), car(), car()], NOW);
    expect(result.inStock).toBe(3);
    expect(result.daysCounted).toBe(1);
    expect(result.avgDaysInStock).toBe(20);
  });
});

describe("hudPills", () => {
  const texts = (s: DealerHudStats) => hudPills(s).map(p => p.text);

  it("shows the stock count and the average, and says all MOTs are in date only when they are", () => {
    expect(texts(stats())).toEqual(["In stock: 5", "Average 34 days in stock", "MOT: all in date"]);
  });

  it("gives each MOT problem its own count, in plain words, and drops the 'all in date' pill", () => {
    const t = texts(stats({ motExpired: 2, motDueSoon: 3, motNoDate: 1 }));
    expect(t).toEqual([
      "In stock: 5",
      "Average 34 days in stock",
      "MOT expired: 2",
      "MOT due within 30 days: 3",
      "No MOT date: 1",
    ]);
  });

  it("never calls a fleet 'all in date' while a car has no MOT date: unknown is not good", () => {
    expect(texts(stats({ motNoDate: 1 }))).not.toContain("MOT: all in date");
    expect(texts(stats({ motNoDate: 1 }))).toContain("No MOT date: 1");
  });

  it("colours an expired MOT red, a due or unknown one amber, and all-clear green", () => {
    const tone = (s: DealerHudStats, text: string) => hudPills(s).find(p => p.text === text)?.tone;
    expect(tone(stats({ motExpired: 1 }), "MOT expired: 1")).toBe("bad");
    expect(tone(stats({ motDueSoon: 1 }), "MOT due within 30 days: 1")).toBe("warn");
    expect(tone(stats({ motNoDate: 1 }), "No MOT date: 1")).toBe("warn");
    expect(tone(stats(), "MOT: all in date")).toBe("good");
  });

  it("leaves the average out when no car has a date, and says so in the tooltip when only some do", () => {
    expect(texts(stats({ avgDaysInStock: null, daysCounted: 0 }))).toEqual(["In stock: 5", "MOT: all in date"]);
    const partial = hudPills(stats({ inStock: 5, daysCounted: 3 })).find(p => p.key === "days");
    expect(partial?.title).toContain("3 cars that have a date added");
    expect(partial?.title).toContain("other 2");
    // ...and doesn't when every car has one
    const full = hudPills(stats({ inStock: 5, daysCounted: 5 })).find(p => p.key === "days");
    expect(full?.title).not.toContain("left out");
  });

  it("uses the singular for one day", () => {
    expect(texts(stats({ avgDaysInStock: 1 }))).toContain("Average 1 day in stock");
  });

  it("makes every pill a link to somewhere that exists", () => {
    for (const p of hudPills(stats({ motExpired: 1, motDueSoon: 1, motNoDate: 1 }))) {
      expect(["/dealer/inventory/list", "/dealer/workflow/mot"]).toContain(p.to);
    }
  });
});

describe("hudSummaryLine", () => {
  it("is the phone's one line: stock, average days, MOT position", () => {
    expect(hudSummaryLine(stats())).toBe("5 in stock · 34 days average · MOT: all in date");
    expect(hudSummaryLine(stats({ motExpired: 2, motDueSoon: 3, motNoDate: 1 }))).toBe(
      "5 in stock · 34 days average · MOT: 2 expired, 3 due within 30 days, 1 with no date"
    );
  });

  it("leaves out the average when there is none", () => {
    expect(hudSummaryLine(stats({ avgDaysInStock: null }))).toBe("5 in stock · MOT: all in date");
  });
});
