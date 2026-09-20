import { describe, it, expect, vi, afterEach } from "vitest";
import { enrichVehicleWithAI, prepareStock, prepareVehicle, withSafeDefaults, withoutRetiredFields } from "./dealerAI";
import type { Vehicle } from "../../types/Vehicle";

// The stock is read back from a server that stores whatever car it was sent. A
// car with no `mot` object (say, one saved by another client) made
// enrichVehicleWithAI throw "Cannot read properties of undefined (reading
// 'advisories')", and because every car was enriched in one go the whole load
// failed: the dealer saw a load error and NO cars although the server held them
// all. Each car is now readied on its own, so one odd record can't hide the rest.
//
// HONESTY RELEASE: this file used to pin the "AI" numbers stamped on every car
// (supernova score 57, flip difficulty 67, valuation confidence 99, a £700
// "Clutch / Drivetrain" prediction over 90,000 miles, and so on). Those were
// worked out from a market heat and a risk score that were 0 on every real car,
// so they were the same guess for every dealer and were shown as if they meant
// something. They are no longer computed, so the tests below pin the opposite:
// nothing invented is added to a car, and the values older versions saved are
// cleared when the car is read. The load-robustness tests are unchanged in what
// they check.

afterEach(() => {
  vi.restoreAllMocks();
});

const RETIRED = [
  "marketHeat",
  "riskScore",
  "supernovaScore",
  "flipDifficulty",
  "valuationConfidence",
  "photoQuality",
  "auctionDelta",
  "buyerPersona",
  "sellerPsychology",
  "predictedRepairs",
] as const;

// A car as an OLDER version saved it: with all ten retired fields filled in.
const car = (over: Record<string, unknown> = {}): Vehicle =>
  ({
    id: "x",
    make: "Ford",
    model: "Fiesta",
    year: 2018,
    mileage: 50000,
    priceRetail: 9000,
    priceTrade: 7000,
    marketHeat: 80,
    riskScore: 20,
    supernovaScore: 57,
    flipDifficulty: 67,
    valuationConfidence: 99,
    photoQuality: 70,
    auctionDelta: 9,
    buyerPersona: ["Budget-Conscious Commuter"],
    sellerPsychology: ["Quick Turnover Focused"],
    predictedRepairs: [{ component: "Clutch / Drivetrain", likelihood: 60, cost: 700 }],
    condition: "Good",
    mot: { expiry: "2030-01-01", advisories: [], historyScore: 0, history: [] },
    depreciationCurve: [],
    finance: { apr: 0, depositMin: 0, lenderTier: "A" },
    img: "/placeholder-car.png",
    status: "In Stock",
    ...over,
  }) as unknown as Vehicle;

// The reviewer's example, exactly: nothing but an id, a make and a model.
const bare = () => ({ id: "bare", make: "Ford", model: "Fiesta" }) as unknown as Vehicle;

const noRetiredFields = (v: Vehicle) => {
  for (const key of RETIRED) expect(v, key).not.toHaveProperty(key);
};

describe("no invented 'AI' fields are added to a car, and old ones are cleared", () => {
  it("a car saved by an older version comes back without any of the ten retired fields", () => {
    const readied = enrichVehicleWithAI(car());
    noRetiredFields(readied);
  });

  it("everything else about the car is kept exactly as it was", () => {
    const original = car({ notes: "Two keys", images: ["a.jpg"], reg: "AB12 CDE", sellPrice: 8800 });
    const readied = enrichVehicleWithAI(original);
    const kept: Record<string, unknown> = { ...original };
    for (const key of RETIRED) delete kept[key];
    expect(readied).toEqual(kept);
  });

  it("a high-mileage car with advisories gets no predicted repairs, personas or scores", () => {
    // The old table would have predicted tyres, brakes, engine seals, suspension,
    // a general wear item and a £700 clutch for this car, from its advisory words
    // and its mileage alone.
    const flagship = car({
      year: 2021,
      mileage: 95000,
      priceRetail: 31000,
      priceTrade: 24000,
      condition: "Excellent",
      status: "In Prep",
      marketHeat: undefined,
      riskScore: undefined,
      supernovaScore: undefined,
      flipDifficulty: undefined,
      valuationConfidence: undefined,
      photoQuality: undefined,
      auctionDelta: undefined,
      buyerPersona: undefined,
      sellerPsychology: undefined,
      predictedRepairs: undefined,
      mot: {
        expiry: "2030-01-01",
        advisories: ["Front tyre worn close to legal limit", "Brake pads wearing thin", "Oil leak from sump"],
        historyScore: 0,
        history: [],
      },
    });
    const readied = enrichVehicleWithAI(flagship);
    noRetiredFields(readied);
    // The real facts, the MOT advisories, are untouched.
    expect(readied.mot.advisories).toEqual([
      "Front tyre worn close to legal limit",
      "Brake pads wearing thin",
      "Oil leak from sump",
    ]);
  });

  it("does not stamp a 0 heat or risk on a car that has none (they used to be defaulted to 0)", () => {
    const readied = enrichVehicleWithAI(car({ marketHeat: undefined, riskScore: null }));
    expect(readied).not.toHaveProperty("marketHeat");
    expect(readied).not.toHaveProperty("riskScore");
    // ...and the safe defaults, on their own, no longer default them to 0 either.
    expect(withSafeDefaults(bare())).not.toHaveProperty("marketHeat");
    expect(withSafeDefaults(bare())).not.toHaveProperty("riskScore");
  });

  it("withoutRetiredFields removes only those fields and does not change the car it was given", () => {
    const original = car();
    const before = structuredClone(original);
    const cleaned = withoutRetiredFields(original);
    noRetiredFields(cleaned);
    expect(cleaned).toMatchObject({ id: "x", make: "Ford", priceRetail: 9000, condition: "Good" });
    expect(original).toEqual(before);
  });

  it("filling in what's missing changes nothing on a car that has it all", () => {
    const good = car({ extra: "kept", mot: { expiry: "2030-01-01", advisories: ["x"], historyScore: 4, history: [], motStatus: "Pass" } });
    expect(withSafeDefaults(good)).toEqual(good);
  });
});

describe("a car missing pieces is readied instead of throwing", () => {
  it("the reviewer's example: an id, a make and a model, and no mot object", () => {
    let readied: Vehicle | undefined;
    expect(() => {
      readied = enrichVehicleWithAI(bare());
    }).not.toThrow();

    expect(readied).toMatchObject({ id: "bare", make: "Ford", model: "Fiesta" });
    expect(readied!.mot).toEqual({ expiry: "", advisories: [], historyScore: 0, history: [] });
    expect(readied!.finance).toEqual({ apr: 0, depositMin: 0, lenderTier: "A" });
    expect(readied!.depreciationCurve).toEqual([]);
    noRetiredFields(readied!); // no invented numbers, not even NaN ones
  });

  it("a mot that isn't an object counts as missing", () => {
    for (const mot of [null, "expired", 7, ["a"], true]) {
      const readied = enrichVehicleWithAI(car({ mot }));
      expect(readied.mot, JSON.stringify(mot)).toEqual({ expiry: "", advisories: [], historyScore: 0, history: [] });
    }
  });

  it("keeps what a partial mot does have, and fills in only the rest", () => {
    const readied = enrichVehicleWithAI(car({ mot: { expiry: "2031-02-03", reg: "AB12 CDE", motStatus: "Pass" } }));
    expect(readied.mot).toEqual({
      expiry: "2031-02-03",
      reg: "AB12 CDE",
      motStatus: "Pass",
      advisories: [],
      historyScore: 0,
      history: [],
    });
  });

  it("advisories that aren't a list, or hold things that aren't text, don't throw", () => {
    expect(() => enrichVehicleWithAI(car({ mot: { advisories: "worn tyre" } }))).not.toThrow();
    expect(() => enrichVehicleWithAI(car({ mot: { advisories: { a: 1 } } }))).not.toThrow();
    expect(enrichVehicleWithAI(car({ mot: { advisories: "worn tyre" } })).mot.advisories).toEqual([]);

    const mixed = enrichVehicleWithAI(car({ mot: { advisories: [null, 5, { x: 1 }, "Tyre worn"] } }));
    expect(mixed.mot.advisories).toEqual([null, 5, { x: 1 }, "Tyre worn"]);
    noRetiredFields(mixed);
  });

  it("a missing finance object or depreciation curve is filled in", () => {
    const readied = enrichVehicleWithAI(car({ finance: undefined, depreciationCurve: undefined }));
    expect(readied.finance).toEqual({ apr: 0, depositMin: 0, lenderTier: "A" });
    expect(readied.depreciationCurve).toEqual([]);
  });

  it("does not change the car it was given", () => {
    const original = bare();
    const before = structuredClone(original);
    enrichVehicleWithAI(original);
    expect(original).toEqual(before);
  });
});

describe("readying one car on its own", () => {
  it("readies a car normally", () => {
    expect(prepareVehicle(car())).toEqual(enrichVehicleWithAI(car()));
    noRetiredFields(prepareVehicle(car()));
  });

  it("keeps a car exactly as it is if it can't be readied (and says so)", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const odd = car();
    // A record this layer really can't read: reading its heat throws.
    Object.defineProperty(odd, "marketHeat", {
      enumerable: true,
      get() {
        throw new Error("cannot read this car");
      },
    });

    const result = prepareVehicle(odd);
    expect(result).toBe(odd); // the very same record, untouched
    expect(errors).toHaveBeenCalledTimes(1);
  });
});

describe("readying the whole stock", () => {
  it("the reviewer's example: a car with no mot next to a good car — both come back", () => {
    const good = car({ id: "good" });
    const readied = prepareStock([bare(), good]);
    expect(readied.map(v => v.id)).toEqual(["bare", "good"]);
    expect(readied[0]!.mot).toBeDefined();
    expect(readied[1]).toEqual(enrichVehicleWithAI(good));
  });

  it("one car that can't be readied doesn't stop the others being readied", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const odd = car({ id: "odd" });
    Object.defineProperty(odd, "riskScore", {
      enumerable: true,
      get() {
        throw new Error("nope");
      },
    });
    const readied = prepareStock([car({ id: "a" }), odd, car({ id: "b" })]);

    expect(readied.map(v => v.id)).toEqual(["a", "odd", "b"]);
    expect(readied[1]).toBe(odd);
    noRetiredFields(readied[0]!);
    noRetiredFields(readied[2]!);
  });

  it("leaves out entries that aren't cars at all, and keeps the order of the rest", () => {
    const list = [null, 5, "x", [], bare(), undefined, car({ id: "good" })] as unknown as Vehicle[];
    expect(prepareStock(list).map(v => v.id)).toEqual(["bare", "good"]);
  });

  it("an empty stock is an empty stock", () => {
    expect(prepareStock([])).toEqual([]);
  });
});
