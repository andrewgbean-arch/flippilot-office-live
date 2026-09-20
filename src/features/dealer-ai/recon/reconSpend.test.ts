import { describe, it, expect } from "vitest";
import type { CostEntry, SaleEntry } from "@/bookkeeping/types";
import { averageSpendOnSoldCars, MIN_SOLD_CARS } from "./reconSpend";

const cost = (vehicleId: string, amount: number): CostEntry => ({ id: `${vehicleId}-${amount}`, vehicleId, type: "recon", amount } as CostEntry);
const sold = (vehicleId: string): SaleEntry => ({ id: `s-${vehicleId}`, vehicleId, salePrice: 5000 } as SaleEntry);

describe("averageSpendOnSoldCars", () => {
  it("needs at least three sold cars with costs logged before it says anything", () => {
    expect(MIN_SOLD_CARS).toBe(3);
    const two = averageSpendOnSoldCars([cost("a", 100), cost("b", 300)], [sold("a"), sold("b")]);
    expect(two).toEqual({ average: null, counted: 2 });
  });

  it("averages the total logged against each sold car", () => {
    const result = averageSpendOnSoldCars(
      [cost("a", 100), cost("a", 200), cost("b", 300), cost("c", 900)],
      [sold("a"), sold("b"), sold("c")]
    );
    // a = 300, b = 300, c = 900  ->  1500 / 3
    expect(result).toEqual({ average: 500, counted: 3 });
  });

  it("ignores costs on cars that are not sold: stock still being prepared is not a finished spend", () => {
    const result = averageSpendOnSoldCars(
      [cost("a", 100), cost("b", 100), cost("c", 100), cost("unsold", 50_000)],
      [sold("a"), sold("b"), sold("c")]
    );
    expect(result).toEqual({ average: 100, counted: 3 });
  });

  it("leaves out a sold car with no costs logged, rather than counting it as £0 spent", () => {
    const result = averageSpendOnSoldCars(
      [cost("a", 300), cost("b", 300), cost("c", 300)],
      [sold("a"), sold("b"), sold("c"), sold("nothing-logged")]
    );
    expect(result).toEqual({ average: 300, counted: 3 });
  });

  it("counts a car once even if it has more than one sale entry", () => {
    const result = averageSpendOnSoldCars(
      [cost("a", 300), cost("b", 300), cost("c", 300)],
      [sold("a"), sold("a"), sold("b"), sold("c")]
    );
    expect(result.counted).toBe(3);
    expect(result.average).toBe(300);
  });

  it("is null with nothing recorded at all", () => {
    expect(averageSpendOnSoldCars([], [])).toEqual({ average: null, counted: 0 });
  });
});
