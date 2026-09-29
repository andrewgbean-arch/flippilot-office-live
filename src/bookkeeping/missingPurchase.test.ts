import { describe, it, expect } from "vitest";
import { vehiclesMissingPurchase } from "./missingPurchase";

describe("which cars the ledger shows without a purchase", () => {
  const vehicles = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("all cars view: only SOLD cars with no purchase, once each", () => {
    const sales = [{ vehicleId: "a" }, { vehicleId: "b" }, { vehicleId: "b" }];
    const purchases = [{ vehicleId: "a" }];
    expect(vehiclesMissingPurchase(sales, purchases, vehicles)).toEqual(["b"]);
  });

  it("an unsold car with no purchase isn't listed in the all cars view", () => {
    expect(vehiclesMissingPurchase([], [], vehicles)).toEqual([]);
  });

  it("one car's own view: shown whenever the car exists and has no purchase, sold or not", () => {
    expect(vehiclesMissingPurchase([], [], vehicles, "c")).toEqual(["c"]);
    expect(vehiclesMissingPurchase([], [{ vehicleId: "c" }], vehicles, "c")).toEqual([]);
    expect(vehiclesMissingPurchase([], [], vehicles, "nowhere")).toEqual([]);
  });
});
