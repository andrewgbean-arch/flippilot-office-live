import { describe, it, expect } from "vitest";
import { bookkeepingDeleteWarning, countBookkeepingRecords } from "./deleteWarning";

// Deleting a car leaves its purchase, sale and cost entries in Bookkeeping with
// no car to belong to (and a sale's invoice can no longer be opened). The
// delete confirmation now says so. See deleteWarning.ts.

describe("countBookkeepingRecords", () => {
  const ledger = {
    sales: [{ vehicleId: "v1" }, { vehicleId: "v2" }],
    purchases: [{ vehicleId: "v1" }, { vehicleId: "v3" }, { vehicleId: "v3" }],
    costs: [{ vehicleId: "v1" }, { vehicleId: "v1" }, { vehicleId: "v2" }, { vehicleId: "v3" }],
  };

  it("counts only the entries for this car", () => {
    expect(countBookkeepingRecords(ledger, "v1")).toEqual({ sales: 1, purchases: 1, costs: 2 });
    expect(countBookkeepingRecords(ledger, "v2")).toEqual({ sales: 1, purchases: 0, costs: 1 });
    expect(countBookkeepingRecords(ledger, "v3")).toEqual({ sales: 0, purchases: 2, costs: 1 });
  });

  it("counts nothing for a car with no entries, or when Bookkeeping is empty", () => {
    expect(countBookkeepingRecords(ledger, "nobody")).toEqual({ sales: 0, purchases: 0, costs: 0 });
    expect(countBookkeepingRecords({ sales: [], purchases: [], costs: [] }, "v1")).toEqual({ sales: 0, purchases: 0, costs: 0 });
  });
});

describe("bookkeepingDeleteWarning", () => {
  it("says nothing when the car has no Bookkeeping records", () => {
    expect(bookkeepingDeleteWarning({ sales: 0, purchases: 0, costs: 0 })).toBeNull();
  });

  it("names the count and each kind of record, and what deleting leaves behind (the example wording)", () => {
    expect(bookkeepingDeleteWarning({ sales: 1, purchases: 1, costs: 2 })).toBe(
      "This car has 4 records in Bookkeeping (a sale, a purchase, 2 costs). " +
        "Deleting it leaves those records without a car, and an invoice for it can no longer be opened."
    );
  });

  it("says a sale's invoice can't be opened only when there is a sale", () => {
    const rows: Array<[number, number, number]> = [
      [0, 1, 0],
      [0, 0, 3],
      [0, 1, 2],
      [1, 0, 0],
      [1, 1, 1],
      [2, 0, 0],
      [3, 2, 5],
    ];
    for (const [sales, purchases, costs] of rows) {
      const text = bookkeepingDeleteWarning({ sales, purchases, costs })!;
      expect(/invoice/.test(text), `${sales} sales, ${purchases} purchases, ${costs} costs`).toBe(sales > 0);
    }
  });

  it("gets singular and plural right", () => {
    expect(bookkeepingDeleteWarning({ sales: 0, purchases: 1, costs: 0 })).toBe(
      "This car has 1 record in Bookkeeping (a purchase). Deleting it leaves that record without a car."
    );
    expect(bookkeepingDeleteWarning({ sales: 0, purchases: 0, costs: 3 })).toBe(
      "This car has 3 records in Bookkeeping (3 costs). Deleting it leaves those records without a car."
    );
    expect(bookkeepingDeleteWarning({ sales: 2, purchases: 0, costs: 0 })).toBe(
      "This car has 2 records in Bookkeeping (2 sales). " +
        "Deleting it leaves those records without a car, and invoices for it can no longer be opened."
    );
    expect(bookkeepingDeleteWarning({ sales: 1, purchases: 0, costs: 0 })).toBe(
      "This car has 1 record in Bookkeeping (a sale). " +
        "Deleting it leaves that record without a car, and an invoice for it can no longer be opened."
    );
  });

  it("lists only the kinds the car has, in the order sale, purchase, cost", () => {
    expect(bookkeepingDeleteWarning({ sales: 0, purchases: 2, costs: 1 })).toContain("(2 purchases, a cost)");
    expect(bookkeepingDeleteWarning({ sales: 1, purchases: 0, costs: 4 })).toContain("(a sale, 4 costs)");
  });
});
