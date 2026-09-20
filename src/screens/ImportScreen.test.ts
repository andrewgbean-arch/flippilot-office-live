import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL Import screen through the hook stand-in, feeds it a CSV like the
// ones a dealer exports from a spreadsheet, and presses Import.
//
// "£5,000" (Excel's currency format) used to be dropped without a word, so the car
// arrived with no price. Now a price that reads is kept, a blank stays unset, and a
// price that is typed but cannot be read is left unset AND counted in the summary.
// How the purchases are saved is deliberately unchanged.

const spies = vi.hoisted(() => ({
  importVehicles: null as null | ((rows: any[]) => any[]),
  addPurchase: null as null | ((entry: any) => void),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const runtime = await import("@/lib/testing/hookRuntime");
  const base = (actual as unknown as { default?: object }).default ?? actual;
  const patched = {
    ...base,
    useState: runtime.useState,
    useEffect: runtime.useEffect,
    useRef: runtime.useRef,
    useCallback: runtime.useCallback,
    useMemo: runtime.useMemo,
  };
  return { ...patched, default: patched };
});
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({ importVehicles: (rows: any[]) => spies.importVehicles!(rows) }),
}));
vi.mock("@/context/ConsumablesContext", () => ({ useConsumables: () => ({ importConsumables: async () => {} }) }));
vi.mock("@/bookkeeping/BookkeepingProvider", () => ({
  useBookkeeping: () => ({ addPurchase: (e: any) => spies.addPurchase!(e) }),
}));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { byId, buttonByText, screenText, findAll } from "@/lib/testing/elementTree";
import ImportScreen from "./ImportScreen";

let mounted: Mounted<any, any>;
let imported: any[];
let purchases: any[];

const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise<void>((resolve) => setTimeout(resolve, 0));
};
const screen = () => mounted.result;

const CSV = [
  "Make,Model,Buy Price,Sell Price",
  'Ford,Focus,"£5,000","£6,500"',
  "Audi,A3,4500,",
  'VW,Golf,"5,00",abc',
  "BMW,X1,0,7000.50",
  "Fiat,500,3000,£x",
].join("\r\n");

async function chooseFile(text: string) {
  const input = byId(screen(), "importscreen-csv-file")!;
  input.props.onChange({ target: { files: [{ name: "stock.csv", text: async () => text }] } });
  await settle();
}
async function pressImport(label: string) {
  buttonByText(screen(), label)!.props.onClick();
  await settle();
}

beforeEach(() => {
  imported = [];
  purchases = [];
  spies.importVehicles = (rows) => {
    imported.push(...rows);
    return rows.map((r, i) => ({ id: `car-${i}`, buyPrice: r.buyPrice ?? null }));
  };
  spies.addPurchase = (e) => void purchases.push(e);
  mounted = mount(ImportScreen as (p: any) => unknown, {}) as Mounted<any, any>;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  mounted?.unmount();
  vi.restoreAllMocks();
});

describe("importing prices from a CSV", () => {
  it("keeps '£5,000' and '£6,500', keeps plain numbers, leaves blanks and zeros unset, and drops unreadable ones without making them 0", async () => {
    await chooseFile(CSV);
    await pressImport("Import 5 Vehicles");

    const byModel = Object.fromEntries(imported.map((r) => [r.model, r]));
    expect(byModel["Focus"]).toMatchObject({ buyPrice: 5000, sellPrice: 6500 }); // the "£5,000" case
    expect(byModel["A3"]).toMatchObject({ buyPrice: 4500, sellPrice: null }); // blank sell price: unset
    expect(byModel["Golf"]).toMatchObject({ buyPrice: null, sellPrice: null }); // "5,00" and "abc": unreadable
    expect(byModel["X1"]).toMatchObject({ buyPrice: null, sellPrice: 7000.5 }); // 0 is unset
    expect(byModel["500"]).toMatchObject({ buyPrice: 3000, sellPrice: null }); // "£x": unreadable
    for (const r of imported) {
      expect(r.buyPrice).not.toBe(0);
      expect(r.sellPrice).not.toBe(0);
      expect(Number.isNaN(r.buyPrice)).toBe(false);
      expect(Number.isNaN(r.sellPrice)).toBe(false);
    }
  });

  it("says how many rows had a price it could not read", async () => {
    await chooseFile(CSV);
    await pressImport("Import 5 Vehicles");
    const t = screenText(screen());
    expect(t).toContain("Imported 5 vehicles.");
    // Golf (both) and Fiat (sell) = 2 rows, each counted once
    expect(t).toContain("2 rows had a price that could not be read, so those prices were left blank.");
    expect(t).toContain("Check the buy and sell prices on those cars.");
  });

  it("flags the same rows in the preview BEFORE importing, and leaves the good ones as Ready", async () => {
    await chooseFile(CSV);
    const t = screenText(screen());
    expect(t).toContain("Ready, but Buy / Trade Price and Sell / Retail Price can't be read and will be left blank");
    expect(t).toContain("Ready, but Sell / Retail Price can't be read and will be left blank");
    expect(findAll(screen(), (el) => el.type === "span" && screenText(el) === "Ready")).toHaveLength(3);
    expect(t).toContain("Preview — 5 of 5 rows ready to import");
  });

  it("says nothing about unreadable prices when every price reads", async () => {
    await chooseFile(["Make,Model,Buy Price,Sell Price", 'Ford,Focus,"£5,000","£6,500"', "Audi,A3,4500,7000"].join("\n"));
    await pressImport("Import 2 Vehicles");
    const t = screenText(screen());
    expect(t).toContain("Imported 2 vehicles.");
    expect(t).not.toContain("could not be read");
    expect(findAll(screen(), (el) => el.props.role === "status")).toHaveLength(0);
  });

  it("says '1 row' in the singular", async () => {
    await chooseFile(["Make,Model,Buy Price,Sell Price", "Ford,Focus,abc,7000", "Audi,A3,4500,7000"].join("\n"));
    await pressImport("Import 2 Vehicles");
    expect(screenText(screen())).toContain("1 row had a price that could not be read, so it was left blank.");
  });

  it("still records a purchase for every car that ended up with a buy price, exactly as before", async () => {
    await chooseFile(CSV);
    await pressImport("Import 5 Vehicles");
    // Focus 5000, A3 4500, Fiat 3000. Golf's unreadable price and X1's 0 record NO purchase.
    expect(purchases.map((p) => p.purchasePrice)).toEqual([5000, 4500, 3000]);
    for (const p of purchases) {
      expect(p).toMatchObject({ source: "CSV Import", vatRate: 0, vatIncluded: false, vatAmount: 0 });
      expect(p.netAmount).toBe(p.purchasePrice);
    }
  });

  it("does not skip a row because its price is unreadable; only missing required fields skip a row", async () => {
    await chooseFile(["Make,Model,Buy Price,Sell Price", "Ford,,4500,6000", "Audi,A3,abc,6000"].join("\n"));
    await pressImport("Import 1 Vehicle");
    const t = screenText(screen());
    expect(t).toContain("Imported 1 vehicle.");
    expect(t).toContain("Skipped 1 row missing required fields.");
    expect(t).toContain("1 row had a price that could not be read");
    expect(imported).toHaveLength(1);
    expect(imported[0].model).toBe("A3");
  });
});
