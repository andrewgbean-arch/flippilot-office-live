import { describe, it, expect } from "vitest";
import type { Vehicle } from "@/types/Vehicle";
import { calendarDaysFromToday, computeMotorsModel, motTiming } from "./motorsModel";

const NOW = new Date("2026-09-20T12:00:00Z");

let nextId = 0;
function car(over: {
  make?: string;
  model?: string;
  reg?: string;
  status?: string;
  expiry?: string | null;
  priceRetail?: number | null;
  priceTrade?: number | null;
} = {}): Vehicle {
  return {
    id: `car-${++nextId}`,
    make: over.make ?? "Ford",
    model: over.model ?? "Fiesta",
    ...(over.reg === undefined ? {} : { reg: over.reg }),
    status: over.status ?? "in stock",
    priceRetail: over.priceRetail === undefined ? null : over.priceRetail,
    priceTrade: over.priceTrade === undefined ? null : over.priceTrade,
    mot: { expiry: over.expiry ?? "", advisories: [] },
  } as unknown as Vehicle;
}

describe("computeMotorsModel: stock and prices", () => {
  it("counts only unsold cars", () => {
    const m = computeMotorsModel([car(), car({ status: "sold" }), car({ status: "Reserved" })], NOW);
    expect(m.inStock).toBe(2);
  });

  it("totals the asking prices of unsold cars only, and says how many cars have none", () => {
    const m = computeMotorsModel(
      [
        car({ priceRetail: 5995 }),
        car({ priceRetail: 11495 }),
        car({ priceRetail: null }),
        car({ priceRetail: 0 }), // 0 means "not entered"
        car({ status: "sold", priceRetail: 20000 }), // a sold car is not stock
      ],
      NOW
    );
    expect(m.askingTotal).toBe(17490);
    expect(m.askingCounted).toBe(2);
    expect(m.noAsking).toBe(2);
  });

  it("averages asking minus trade price over cars with BOTH entered, ignoring the rest", () => {
    const m = computeMotorsModel(
      [
        car({ priceRetail: 5995, priceTrade: 4500 }), // 1495
        car({ priceRetail: 11495, priceTrade: 10000 }), // 1495
        car({ priceRetail: 3000, priceTrade: 3500 }), // a real loss: -500
        car({ priceRetail: 8000, priceTrade: null }), // no trade price: not a 100% margin
        car({ priceRetail: null, priceTrade: 2000 }), // no asking price
        car({ status: "sold", priceRetail: 9000, priceTrade: 1000 }),
      ],
      NOW
    );
    expect(m.marginCounted).toBe(3);
    expect(m.marginAverage).toBeCloseTo((1495 + 1495 - 500) / 3, 6);
  });

  it("gives a null margin, not 0, when no car has both prices", () => {
    const m = computeMotorsModel([car({ priceRetail: 5000 }), car({ priceTrade: 4000 })], NOW);
    expect(m.marginAverage).toBeNull();
    expect(m.marginCounted).toBe(0);
  });

  it("is all zeros and empty for no stock", () => {
    const m = computeMotorsModel([], NOW);
    expect(m).toMatchObject({ inStock: 0, askingTotal: 0, askingCounted: 0, noAsking: 0, marginAverage: null });
    expect(m.motAttention).toEqual([]);
    expect(m.noMotDate).toEqual([]);
    expect(m.makes).toEqual([]);
  });

  it("does not offer any score, valuation or market figure", () => {
    const keys = Object.keys(computeMotorsModel([car()], NOW)).sort();
    expect(keys).toEqual(
      ["askingCounted", "askingTotal", "inStock", "makes", "marginAverage", "marginCounted", "mot", "motAttention", "noAsking", "noMotDate"].sort()
    );
  });
});

describe("computeMotorsModel: MOT", () => {
  it("lists expired and due-soon unsold cars, soonest first, and leaves valid and sold ones out", () => {
    const expired = car({ make: "Vauxhall", model: "Corsa", reg: "ab12 cde", expiry: "2026-09-10", priceRetail: 3295 });
    const dueToday = car({ make: "Audi", model: "A3", expiry: "2026-09-20" });
    const due = car({ make: "BMW", model: "3 Series", expiry: "2026-10-05", priceRetail: 11495 });
    const fine = car({ expiry: "2027-06-01" });
    const soldExpired = car({ status: "sold", expiry: "2020-01-01" });
    const m = computeMotorsModel([due, fine, dueToday, soldExpired, expired], NOW);

    expect(m.motAttention.map(r => r.title)).toEqual(["Vauxhall Corsa", "Audi A3", "BMW 3 Series"]);
    expect(m.motAttention.map(r => r.kind)).toEqual(["expired", "soon", "soon"]);
    expect(m.motAttention.map(r => r.timing)).toEqual(["expired 10 days ago", "expires today", "15 days left"]);
    expect(m.motAttention[0]).toMatchObject({ reg: "AB12 CDE", asking: 3295, daysFromToday: -10 });
    expect(m.motAttention[1]?.asking).toBeNull();
    expect(m.mot).toEqual({ expired: 1, dueSoon: 2, valid: 1, noDate: 0 });
  });

  it("lists cars with no MOT date separately, not silently skipped and not counted as fine", () => {
    const m = computeMotorsModel([car({ make: "Kia", model: "Rio", expiry: "" }), car({ expiry: "2027-06-01" })], NOW);
    expect(m.noMotDate.map(r => r.title)).toEqual(["Kia Rio"]);
    expect(m.mot.noDate).toBe(1);
    expect(m.motAttention).toEqual([]);
  });
});

describe("computeMotorsModel: makes", () => {
  it("groups makes ignoring case and stray spaces, biggest first, and skips blanks and sold cars", () => {
    const m = computeMotorsModel(
      [
        car({ make: "Ford" }),
        car({ make: "ford " }),
        car({ make: "Audi" }),
        car({ make: "BMW" }),
        car({ make: "Audi" }),
        car({ make: "Ford" }),
        car({ make: "   " }),
        car({ make: "Skoda", status: "sold" }),
      ],
      NOW
    );
    expect(m.makes).toEqual([
      { make: "Ford", count: 3 },
      { make: "Audi", count: 2 },
      { make: "BMW", count: 1 },
    ]);
  });
});

describe("calendarDaysFromToday and motTiming", () => {
  it("counts calendar days, so a date-only expiry does not slip a day", () => {
    expect(calendarDaysFromToday("2026-09-20", NOW)).toBe(0);
    expect(calendarDaysFromToday("2026-09-21", NOW)).toBe(1);
    expect(calendarDaysFromToday("2026-09-19", NOW)).toBe(-1);
    expect(calendarDaysFromToday("nonsense", NOW)).toBeNull();
  });

  it("words the timing plainly, singular and plural", () => {
    expect(motTiming("expired", -1)).toBe("expired 1 day ago");
    expect(motTiming("expired", -12)).toBe("expired 12 days ago");
    expect(motTiming("expired", 0)).toBe("expired today");
    expect(motTiming("soon", 0)).toBe("expires today");
    expect(motTiming("soon", 1)).toBe("1 day left");
    expect(motTiming("soon", 29)).toBe("29 days left");
  });
});
