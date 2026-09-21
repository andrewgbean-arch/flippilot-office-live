import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL Import screen through the hook stand-in, feeds it a CSV like the
// ones a dealer exports from a spreadsheet, and presses Import.
//
// "£5,000" (Excel's currency format) used to be dropped without a word, so the car
// arrived with no price. Now a price that reads is kept, a blank stays unset, and a
// price that is typed but cannot be read is left unset AND counted in the summary.
// The purchases go to the books as ONE batch (see importPurchases.test.ts for the real books).

const spies = vi.hoisted(() => ({
  importVehicles: null as null | ((rows: any[]) => any[]),
  addPurchases: null as null | ((entries: any[]) => number),
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
  useBookkeeping: () => ({ addPurchases: (e: any[]) => spies.addPurchases!(e) }),
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
  spies.addPurchases = (e) => {
    purchases.push(...e);
    return e.length;
  };
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

// The files a dealer really has. Excel's default "CSV (Comma delimited)" on a UK
// Windows PC is Windows-1252, where the pound sign is the single byte 0xA3. That is
// not valid UTF-8, so reading the file as UTF-8 (file.text()) turned every "£5,000"
// into a replacement character and the price could not be read.
describe("the file's own encoding", () => {
  // A CSV as bytes: text with each pound sign written as the one Windows-1252 byte.
  const windows1252 = (text: string) => Uint8Array.from(Array.from(text, (ch) => (ch === "£" ? 0xa3 : ch.charCodeAt(0))));
  const utf8 = (text: string) => new TextEncoder().encode(text);

  async function chooseBytes(bytes: Uint8Array) {
    const input = byId(screen(), "importscreen-csv-file")!;
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    input.props.onChange({
      target: {
        files: [
          {
            name: "stock.csv",
            arrayBuffer: async () => buffer,
            // What file.text() would have given: UTF-8 only.
            text: async () => new TextDecoder("utf-8").decode(bytes),
          },
        ],
      },
    });
    await settle();
  }

  const FILE = 'Make,Model,Buy Price,Sell Price\r\nFord,Focus,"£5,000","£6,500"\r\nAudi,A3,£4500,£7000\r\n';

  it("reads the prices in an Excel (Windows-1252) file: the pound sign is not lost", async () => {
    await chooseBytes(windows1252(FILE));
    const t = screenText(screen());
    expect(t).not.toContain("can't be read"); // the preview flags nothing
    expect(t).not.toContain("\uFFFD");
    await pressImport("Import 2 Vehicles");
    const byModel = Object.fromEntries(imported.map((r) => [r.model, r]));
    expect(byModel["Focus"]).toMatchObject({ buyPrice: 5000, sellPrice: 6500 });
    expect(byModel["A3"]).toMatchObject({ buyPrice: 4500, sellPrice: 7000 });
    expect(screenText(screen())).not.toContain("could not be read");
  });

  it("still reads a UTF-8 file, with or without a byte order mark", async () => {
    for (const bom of ["", "\uFEFF"]) {
      mounted.unmount();
      imported = [];
      mounted = mount(ImportScreen as (p: any) => unknown, {}) as Mounted<any, any>;
      await chooseBytes(utf8(bom + FILE));
      await pressImport("Import 2 Vehicles");
      expect(imported.map((r) => [r.model, r.buyPrice, r.sellPrice])).toEqual([
        ["Focus", 5000, 6500],
        ["A3", 4500, 7000],
      ]);
      expect(imported[0]).toMatchObject({ make: "Ford" }); // the BOM did not glue itself to the header
    }
  });

  it("keeps accented letters in a UTF-8 file (the fallback is only for bytes that are not UTF-8)", async () => {
    await chooseBytes(utf8("Make,Model,Buy Price\r\nCitroën,C3,£3000\r\n"));
    await pressImport("Import 1 Vehicle");
    expect(imported[0]).toMatchObject({ make: "Citroën", buyPrice: 3000 });
  });

  it("keeps accented letters in a Windows-1252 file too", async () => {
    const bytes = Uint8Array.from([...windows1252("Make,Model,Buy Price\r\nCitro"), 0xeb, ...windows1252("n,C3,£3000\r\n")]);
    await chooseBytes(bytes);
    await pressImport("Import 1 Vehicle");
    expect(imported[0]).toMatchObject({ make: "Citroën", buyPrice: 3000 });
  });
});

// A mileage written the way a spreadsheet shows it ("45,000") is NaN to Number, so it
// was dropped with no warning (the same way "£5,000" used to be).
describe("year and mileage", () => {
  const FILE = [
    "Make,Model,Year,Mileage",
    'Ford,Focus,2014,"45,000"',
    "Audi,A3,2016,62000",
    "VW,Golf,14,45k",
    "BMW,X1,,",
    "Fiat,500,2014.5,0",
  ].join("\r\n");

  it("keeps '45,000' as 45000, leaves blanks and zeros unset, and never makes up a number", async () => {
    await chooseFile(FILE);
    await pressImport("Import 5 Vehicles");
    const byModel = Object.fromEntries(imported.map((r) => [r.model, r]));
    expect(byModel["Focus"]).toMatchObject({ year: 2014, mileage: 45000 });
    expect(byModel["A3"]).toMatchObject({ year: 2016, mileage: 62000 });
    expect(byModel["Golf"]).toMatchObject({ year: null, mileage: null }); // "14" and "45k": unreadable
    expect(byModel["X1"]).toMatchObject({ year: null, mileage: null });
    expect(byModel["500"]).toMatchObject({ year: null, mileage: null });
  });

  it("says how many rows had a year or mileage it could not read", async () => {
    await chooseFile(FILE);
    await pressImport("Import 5 Vehicles");
    // Golf (both) and Fiat (year) = 2 rows
    expect(screenText(screen())).toContain("2 rows had a year or mileage that could not be read, so those were left blank.");
  });

  it("flags them in the preview before importing", async () => {
    await chooseFile(FILE);
    expect(screenText(screen())).toContain("Ready, but Year and Mileage can't be read and will be left blank");
  });

  it("says nothing when they all read", async () => {
    await chooseFile(["Make,Model,Year,Mileage", 'Ford,Focus,2014,"45,000"', "Audi,A3,2016,62000"].join("\n"));
    await pressImport("Import 2 Vehicles");
    expect(screenText(screen())).not.toContain("year or mileage");
  });
});

describe("the purchases are saved as one batch, and a failure is reported", () => {
  const PRICED = ["Make,Model,Buy Price", "Ford,Focus,5000", "Audi,A3,4500", "VW,Golf,3000"].join("\n");
  let calls: any[][];

  it("hands every purchase to the books in ONE call", async () => {
    calls = [];
    spies.addPurchases = (e) => {
      calls.push(e);
      return e.length;
    };
    await chooseFile(PRICED);
    await pressImport("Import 3 Vehicles");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.map((p) => p.purchasePrice)).toEqual([5000, 4500, 3000]);
    expect(findAll(screen(), (el) => el.props.role === "alert")).toHaveLength(0);
  });

  it("says so when the books could not take the purchases, instead of only reporting success", async () => {
    spies.addPurchases = () => 0; // e.g. the books had not loaded, or the save was refused
    await chooseFile(PRICED);
    await pressImport("Import 3 Vehicles");
    const t = screenText(screen());
    expect(t).toContain("Imported 3 vehicles.");
    expect(t).toContain("3 of the imported cars had a buy price, but their purchase records could not be saved to your books");
    expect(findAll(screen(), (el) => el.props.role === "alert")).toHaveLength(1);
  });

  it("reports only the ones that were short", async () => {
    spies.addPurchases = (e) => e.length - 1;
    await chooseFile(PRICED);
    await pressImport("Import 3 Vehicles");
    expect(screenText(screen())).toContain("1 of the imported cars had a buy price, but its purchase record could not be saved");
  });

  it("makes no purchase call, and no complaint, when no car has a buy price", async () => {
    calls = [];
    spies.addPurchases = (e) => {
      calls.push(e);
      return e.length;
    };
    await chooseFile(["Make,Model", "Ford,Focus", "Audi,A3"].join("\n"));
    await pressImport("Import 2 Vehicles");
    expect(calls).toEqual([]);
    expect(findAll(screen(), (el) => el.props.role === "alert")).toHaveLength(0);
  });
});
