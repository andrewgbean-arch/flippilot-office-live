import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hubTotals } from "./profitTotals";
import type { PurchaseEntry } from "./types";

// Deleting a car from stock leaves its purchase and costs in the books (the money was spent). It was
// still counted as a car "bought, not yet sold" and its ledger row said "Unknown vehicle".

const buy = (vehicleId: string, price: number) => ({ id: `p-${vehicleId}`, vehicleId, purchasePrice: price, source: "Auction", date: "2026-03-01" }) as unknown as PurchaseEntry;

describe("cars bought but not yet sold", () => {
  const purchases = [buy("here", 4000), buy("deleted", 3000)];

  it("counts every purchase when it is not known which cars are still in stock", () => {
    expect(hubTotals(purchases, [], [], null).boughtNotSold).toBe(2);
    expect(hubTotals(purchases, [], []).boughtNotSold).toBe(2);
  });

  it("leaves out a car that was deleted from stock, but not the money spent on it", () => {
    const totals = hubTotals(purchases, [], [], new Set(["here"]));
    expect(totals.boughtNotSold).toBe(1);
    expect(totals.spend).toBe(7000);
  });
});

describe("the ledger row for a deleted car", () => {
  const source = readFileSync(join(__dirname, "BookkeepingTable.tsx"), "utf8");

  it("says Removed car once stock has loaded, and Unknown vehicle while it has not (or failed)", () => {
    expect(source).toContain('stockLoading || stockLoadError ? "Unknown vehicle" : "Removed car"');
  });

  it("the hub passes the loaded stock to the totals", () => {
    const hub = readFileSync(join(__dirname, "BookkeepingScreen.tsx"), "utf8");
    expect(hub).toContain("stockLoading || stockLoadError ? null : new Set(vehicles.map(v => v.id))");
    expect(hub).toContain("hubTotals(purchases, sales, costs, carsInStock)");
  });
});
