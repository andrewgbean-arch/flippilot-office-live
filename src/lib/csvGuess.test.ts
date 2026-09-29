import { describe, it, expect } from "vitest";
import { guessColumns } from "./csv";

// The import screen guesses which spreadsheet column is which. A partial match
// on "price" used to let a "Purchase Price" column be picked as the sell price
// too, so an imported car showed its cost as its asking price.

const VEHICLE = [
  { key: "make", aliases: ["make", "manufacturer", "brand"] },
  { key: "model", aliases: ["model"] },
  { key: "reg", aliases: ["reg", "registration", "plate", "vrm", "reg no", "reg number"] },
  { key: "year", aliases: ["year", "reg year", "model year"] },
  { key: "buyPrice", aliases: ["buy price", "trade price", "cost price", "purchase price", "cost"] },
  { key: "sellPrice", aliases: ["sell price", "sale price", "selling price", "retail price", "asking price", "price"] },
];

describe("guessing spreadsheet columns", () => {
  it("never gives the buy price column to the sell price as well", () => {
    const g = guessColumns(["Make", "Model", "Purchase Price", "Sale Price"], VEHICLE);
    expect(g.buyPrice).toBe("Purchase Price");
    expect(g.sellPrice).toBe("Sale Price");
  });

  it("with only a purchase price, leaves the sell price for the dealer to choose", () => {
    const g = guessColumns(["Make", "Model", "Purchase Price"], VEHICLE);
    expect(g.buyPrice).toBe("Purchase Price");
    expect(g.sellPrice).toBeUndefined();
  });

  it("an exact heading beats a partial one, whatever order the columns are in", () => {
    const g = guessColumns(["Trade Price", "Price"], VEHICLE);
    expect(g.buyPrice).toBe("Trade Price");
    expect(g.sellPrice).toBe("Price");
  });

  it("an exact 'Price' heading wins over an earlier 'Price Band' column", () => {
    const g = guessColumns(["Make", "Model", "Price Band", "Price"], VEHICLE);
    expect(g.sellPrice).toBe("Price");
  });

  it("matches whole words only: 'reg' is not 'Region', 'cost' is not 'Costa'", () => {
    const g = guessColumns(["Region", "Costa Branch", "Make", "Model"], VEHICLE);
    expect(g.reg).toBeUndefined();
    expect(g.buyPrice).toBeUndefined();
  });

  it("still finds headings with extra words or symbols around the alias", () => {
    const g = guessColumns(["Vehicle Make", "Model", "Reg No.", "Asking Price (£)", "Cost Price £"], VEHICLE);
    expect(g.make).toBe("Vehicle Make");
    expect(g.reg).toBe("Reg No.");
    expect(g.sellPrice).toBe("Asking Price (£)");
    expect(g.buyPrice).toBe("Cost Price £");
  });

  it("gives each column to one field only", () => {
    const g = guessColumns(["Make", "Model Year"], VEHICLE);
    const used = Object.values(g);
    expect(new Set(used).size).toBe(used.length);
  });

  it("ignores case and surrounding spaces for exact matches", () => {
    const g = guessColumns(["  MAKE ", "model"], VEHICLE);
    expect(g.make).toBe("  MAKE ");
    expect(g.model).toBe("model");
  });
});
