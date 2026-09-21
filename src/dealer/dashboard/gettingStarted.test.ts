import { describe, it, expect } from "vitest";
import type { Vehicle } from "@/types/Vehicle";
import type { SaleEntry } from "@/bookkeeping/types";
import type { Appointment } from "@/appointments/appointmentTypes";
import { gettingStartedComplete, gettingStartedItems, pastBookingsToMark, type GettingStartedItem, type GettingStartedKey } from "./gettingStarted";

const NOW = new Date("2026-09-21T12:00:00Z");
const DAY = 86_400_000;
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY).toISOString();
const dateKey = (n: number) => daysFromNow(n).slice(0, 10);

let nextId = 0;
const car = (over: Partial<{ status: string; images: string[] | null; expiry: string }> = {}): Vehicle =>
  ({
    id: `car-${++nextId}`,
    make: "Ford",
    model: "Fiesta",
    status: over.status ?? "in_stock",
    images: over.images === undefined ? ["a.jpg"] : over.images,
    mot: { expiry: over.expiry ?? daysFromNow(200).slice(0, 10), advisories: [] },
  }) as unknown as Vehicle;
const sale = (): SaleEntry => ({ id: `s-${++nextId}`, vehicleId: "v", salePrice: 1, date: "2026-09-01" }) as unknown as SaleEntry;
const booking = (over: Partial<Appointment> = {}): Appointment =>
  ({ id: `a-${++nextId}`, type: "viewing", status: "confirmed", requestedDate: dateKey(-2), requestedTime: "10:00", ...over }) as unknown as Appointment;

const base = { vehicles: [] as Vehicle[], sales: [] as SaleEntry[], appointments: [] as Appointment[], decisionsTotal: null, canUseDecisions: true, now: NOW };
const byKey = (items: ReturnType<typeof gettingStartedItems>) => Object.fromEntries(items.map(i => [i.key, i])) as Record<GettingStartedKey, GettingStartedItem>;

describe("Getting started: what a brand-new dealership sees", () => {
  it("lists all four things undone, with plain reasons, for an owner with nothing recorded", () => {
    const items = byKey(gettingStartedItems(base));
    expect(Object.keys(items)).toEqual(["sale", "outcomes", "cars", "decision"]);
    expect(items.sale.done).toBe(false);
    expect(items.outcomes.done).toBe(false);
    expect(items.outcomes.detail).toContain("public booking page");
    expect(items.cars.done).toBe(false);
    expect(items.cars.detail).toContain("No cars in stock yet");
    expect(items.cars.to).toBe("/new-flip");
    expect(items.decision.done).toBe(false);
    expect(gettingStartedComplete(Object.values(items))).toBe(false);
  });

  it("leaves the decision item out for staff who cannot open the journal", () => {
    const items = gettingStartedItems({ ...base, canUseDecisions: false });
    expect(items.map(i => i.key)).toEqual(["sale", "outcomes", "cars"]);
  });
});

describe("Getting started: ticking off from the real records", () => {
  it("counts recorded sales", () => {
    const items = byKey(gettingStartedItems({ ...base, sales: [sale(), sale()] }));
    expect(items.sale.done).toBe(true);
    expect(items.sale.detail).toBe("2 sales recorded.");
  });

  it("wants photos AND an MOT date on every unsold car, and says which are missing", () => {
    const items = byKey(gettingStartedItems({ ...base, vehicles: [car(), car({ images: [] }), car({ expiry: "" }), car({ status: "sold", images: [] })] }));
    expect(items.cars.done).toBe(false);
    expect(items.cars.detail).toBe("1 without a photo, 1 without an MOT date.");
    expect(items.cars.to).toBe("/dealer/inventory/list");

    const done = byKey(gettingStartedItems({ ...base, vehicles: [car(), car()] }));
    expect(done.cars.done).toBe(true);
    expect(done.cars.detail).toBe("All 2 cars have a photo and an MOT date.");
  });

  it("counts marked outcomes and says how many past bookings still need marking", () => {
    const appointments = [booking({ outcome: "showed" }), booking(), booking({ requestedDate: dateKey(3) }), booking({ status: "pending" })];
    expect(pastBookingsToMark(appointments, NOW)).toHaveLength(1);
    const items = byKey(gettingStartedItems({ ...base, appointments }));
    expect(items.outcomes.done).toBe(true);
    expect(items.outcomes.detail).toBe("1 outcome marked, 1 still to mark.");

    const none = byKey(gettingStartedItems({ ...base, appointments: [booking(), booking()] }));
    expect(none.outcomes.done).toBe(false);
    expect(none.outcomes.detail).toBe("2 past bookings to mark showed, bought or no-show.");
  });

  it("treats a decision count that has not loaded as not done, never as done", () => {
    expect(byKey(gettingStartedItems({ ...base, decisionsTotal: null })).decision.done).toBe(false);
    expect(byKey(gettingStartedItems({ ...base, decisionsTotal: 1 })).decision.done).toBe(true);
  });

  it("is complete only when every listed item is done", () => {
    const items = gettingStartedItems({ ...base, vehicles: [car()], sales: [sale()], appointments: [booking({ outcome: "purchased" })], decisionsTotal: 2 });
    expect(gettingStartedComplete(items)).toBe(true);
    const staff = gettingStartedItems({ ...base, vehicles: [car()], sales: [sale()], appointments: [booking({ outcome: "purchased" })], canUseDecisions: false });
    expect(gettingStartedComplete(staff)).toBe(true);
  });
});
