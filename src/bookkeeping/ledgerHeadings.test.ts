import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The ledger's cost column holds only what was spent ON TOP of the purchase price (parts,
// tyres, transport), so a row reading "Purchase £3,200, Total Cost £150" looked as if the whole
// car had cost £150. The heading says what the column is.

const source = readFileSync(join(__dirname, "BookkeepingTable.tsx"), "utf8");
const headings = [...source.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map(m => m[1]!.trim());

describe("the acquisition ledger's headings", () => {
  it("call the cost column Extra Costs, next to the purchase price it is on top of", () => {
    expect(headings.slice(0, 3)).toEqual(["Vehicle", "Purchase", "Extra Costs"]);
  });

  it("never call that column the total cost", () => {
    expect(headings.some(h => /total cost/i.test(h))).toBe(false);
  });
});
