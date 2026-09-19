import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { enrichVehicleWithAI, prepareStock, prepareVehicle, withSafeDefaults } from "./dealerAI";
import type { Vehicle } from "../../types/Vehicle";

// The stock is read back from a server that stores whatever car it was sent. A
// car with no `mot` object (say, one saved by another client) made
// enrichVehicleWithAI throw "Cannot read properties of undefined (reading
// 'advisories')", and because every car was enriched in one go the whole load
// failed: the dealer saw a load error and NO cars although the server held them
// all. Each car is now readied on its own, so one odd record can't hide the rest.

// The supernova score depends on the current year, so pin the clock.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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

const scores = (v: Vehicle) => ({
  supernovaScore: v.supernovaScore,
  flipDifficulty: v.flipDifficulty,
  valuationConfidence: v.valuationConfidence,
  photoQuality: v.photoQuality,
  auctionDelta: v.auctionDelta,
  buyerPersona: v.buyerPersona,
  sellerPsychology: v.sellerPsychology,
  predictedRepairs: v.predictedRepairs,
});

const allFinite = (v: Vehicle) =>
  [v.supernovaScore, v.flipDifficulty, v.valuationConfidence, v.photoQuality, v.auctionDelta].every(
    n => typeof n === "number" && Number.isFinite(n)
  );

describe("a well-formed car is enriched exactly as it always was", () => {
  // Numbers captured from the enrichment BEFORE it was made tolerant.
  it("an ordinary car", () => {
    expect(scores(enrichVehicleWithAI(car()))).toEqual({
      supernovaScore: 57,
      flipDifficulty: 67,
      valuationConfidence: 99,
      photoQuality: 70,
      auctionDelta: 9,
      buyerPersona: ["Budget-Conscious Commuter"],
      sellerPsychology: [],
      predictedRepairs: [],
    });
  });

  it("a high-mileage car with advisories, in prep", () => {
    const flagship = car({
      year: 2021,
      mileage: 95000,
      priceRetail: 31000,
      priceTrade: 24000,
      marketHeat: 92,
      riskScore: 60,
      condition: "Excellent",
      status: "In Prep",
      mot: {
        expiry: "2030-01-01",
        advisories: [
          "Front tyre worn close to legal limit",
          "Brake pads wearing thin",
          "Oil leak from sump",
          "Suspension arm bush deteriorated",
          "Something else",
        ],
        historyScore: 0,
        history: [],
      },
    });
    expect(scores(enrichVehicleWithAI(flagship))).toEqual({
      supernovaScore: 46,
      flipDifficulty: 100,
      valuationConfidence: 71,
      photoQuality: 75,
      auctionDelta: 15,
      buyerPersona: ["Performance Enthusiast", "Status-Conscious Buyer", "Low-Risk Buyer", "FOMO Buyer"],
      sellerPsychology: ["Profit Maximiser", "Detail-Oriented Presentation", "Risk Offloader", "Market Timing Strategist"],
      predictedRepairs: [
        { component: "Tyres", likelihood: 80, cost: 300 },
        { component: "Brakes", likelihood: 75, cost: 250 },
        { component: "Engine Seals / Gaskets", likelihood: 65, cost: 450 },
        { component: "Suspension Components", likelihood: 70, cost: 500 },
        { component: "General Wear Item", likelihood: 50, cost: 200 },
        { component: "Clutch / Drivetrain", likelihood: 60, cost: 700 },
      ],
    });
  });

  it("a car with no year or mileage", () => {
    const fair = car({ condition: "Fair", priceRetail: 16000, priceTrade: 15000, marketHeat: 50, riskScore: 10, year: null, mileage: null });
    expect(scores(enrichVehicleWithAI(fair))).toEqual({
      supernovaScore: 0,
      flipDifficulty: 22,
      valuationConfidence: 91,
      photoQuality: 60,
      auctionDelta: 10,
      buyerPersona: ["Comfort & Tech Seeker", "DIY Mechanic / Enthusiast"],
      sellerPsychology: ["Quick Turnover Focused"],
      predictedRepairs: [],
    });
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
    expect(allFinite(readied!)).toBe(true); // real numbers, not NaN
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

    const mixed = enrichVehicleWithAI(car({ mot: { advisories: [null, 5, { x: 1 }, "Tyre worn"] } }));
    expect(mixed.predictedRepairs).toEqual([{ component: "Tyres", likelihood: 80, cost: 300 }]);
  });

  it("a missing finance object or depreciation curve is filled in; missing heat and risk count as 0", () => {
    const readied = enrichVehicleWithAI(car({ finance: undefined, depreciationCurve: undefined, marketHeat: undefined, riskScore: null }));
    expect(readied.finance).toEqual({ apr: 0, depositMin: 0, lenderTier: "A" });
    expect(readied.depreciationCurve).toEqual([]);
    expect(readied.marketHeat).toBe(0);
    expect(readied.riskScore).toBe(0);
    expect(allFinite(readied)).toBe(true);
  });

  it("does not change the car it was given", () => {
    const original = bare();
    const before = structuredClone(original);
    enrichVehicleWithAI(original);
    expect(original).toEqual(before);
  });
});

describe("readying one car on its own", () => {
  it("enriches a car normally", () => {
    expect(scores(prepareVehicle(car()))).toEqual(scores(enrichVehicleWithAI(car())));
  });

  it("keeps a car exactly as it is, unscored, if it can't be enriched (and says so)", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const odd = car();
    // A record the AI layer really can't read: reading its heat throws.
    Object.defineProperty(odd, "marketHeat", {
      enumerable: true,
      get() {
        throw new Error("cannot read this car");
      },
    });

    const result = prepareVehicle(odd);
    expect(result).toBe(odd); // the very same record, untouched
    expect(result.supernovaScore).toBeUndefined();
    expect(errors).toHaveBeenCalledTimes(1);
  });
});

describe("readying the whole stock", () => {
  it("the reviewer's example: a car with no mot next to a good car — both come back", () => {
    const good = car({ id: "good" });
    const readied = prepareStock([bare(), good]);
    expect(readied.map(v => v.id)).toEqual(["bare", "good"]);
    expect(readied[0]!.mot).toBeDefined();
    expect(readied[1]).toMatchObject(scores(enrichVehicleWithAI(good)));
  });

  it("one car that can't be enriched doesn't stop the others being enriched", () => {
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
    expect(readied[0]!.supernovaScore).toBeTypeOf("number");
    expect(readied[2]!.supernovaScore).toBeTypeOf("number");
  });

  it("leaves out entries that aren't cars at all, and keeps the order of the rest", () => {
    const list = [null, 5, "x", [], bare(), undefined, car({ id: "good" })] as unknown as Vehicle[];
    expect(prepareStock(list).map(v => v.id)).toEqual(["bare", "good"]);
  });

  it("an empty stock is an empty stock", () => {
    expect(prepareStock([])).toEqual([]);
  });
});
