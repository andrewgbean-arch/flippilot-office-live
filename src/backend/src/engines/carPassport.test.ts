import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONFIG,
  MAX_IMAGES,
  MAX_MARKET_AGE_DAYS,
  MAX_MOT_TESTS,
  MAX_NOTE,
  MAX_WORK_LINE,
  MAX_WORK_LINES,
  MIN_MARKET_LISTINGS,
  buildPublicPassport,
  isSoldVehicle,
  marketSection,
  motSection,
  normaliseConfig,
  parseConfigInput,
  passportImages,
  suggestWorkDone,
  type PassportConfig,
} from "./carPassport";

// A fixed "now" so nothing here depends on the real date.
const NOW = Date.parse("2030-03-15T12:00:00Z");
const DAY = 86400000;
const dayOffset = (n: number) => new Date(NOW + n * DAY).toISOString().slice(0, 10);

const published: PassportConfig = { ...DEFAULT_CONFIG, published: true, workDone: [], updatedAt: "2030-03-01T00:00:00Z" };

// Everything a careless projection could leak, planted in the fields it would leak from.
const SECRETS = [
  "SECRET-BUY-9000",
  "SECRET-NOTE",
  "SECRET-CUSTOMER",
  "SECRET-TESTNUM",
  "SECRET-VIN",
  "SECRET-SUPPLIER",
  "777777",
];

const car = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "v1",
  reg: "ab12 cde",
  year: 2019,
  make: "Ford",
  model: "Fiesta",
  mileage: 42000,
  colour: "Blue",
  status: "in stock",
  priceRetail: 8495,
  buyPrice: 777777,
  purchasePrice: 777777,
  expectedSale: 777777,
  sellPrice: 777777,
  notes: "SECRET-NOTE bought from SECRET-SUPPLIER",
  vin: "SECRET-VIN",
  customerName: "SECRET-CUSTOMER",
  images: ["https://api.example.test/photos/aaa.jpg"],
  mot: {
    expiry: "2030-09-01",
    fuelType: "PETROL",
    euroStatus: "Euro 6",
    history: [
      { date: "2029-09-01", result: "PASSED", mileage: 30000, advisories: ["Tyre wearing"], failures: [], testNumber: "SECRET-TESTNUM" },
    ],
  },
  ...over,
});

const dealership = { name: "Sam's Motors", phone: "01234 567890", address: "1 High Street", inviteEpoch: 9, stripeCustomerId: "SECRET-BUY-9000" };

const build = (over: Partial<PassportConfig> = {}, vehicle = car(), snapshots: unknown = []) =>
  buildPublicPassport({ dealership, vehicle, config: { ...published, ...over }, snapshots, now: NOW });

describe("normaliseConfig", () => {
  it("is not published, with market comparison OFF, until the dealer says otherwise", () => {
    for (const raw of [undefined, null, 5, "x", [], {}]) {
      const c = normaliseConfig(raw);
      expect(c.published, String(raw)).toBe(false);
      expect(c.showMarket).toBe(false);
      expect(c.showReg && c.showMot && c.showUlez).toBe(true);
      expect(c.workDone).toEqual([]);
    }
  });

  it("only treats a real 'true' as published", () => {
    for (const published of ["true", 1, "yes", {}, null]) expect(normaliseConfig({ published }).published, String(published)).toBe(false);
    expect(normaliseConfig({ published: true }).published).toBe(true);
  });

  it("reads back what was saved, tidying damaged lines and text", () => {
    const c = normaliseConfig({ published: true, showMarket: true, showReg: false, workDone: ["  New pads ", "new pads", 7, "", null, "x".repeat(500)], note: "  hi\nthere " });
    expect(c.showMarket).toBe(true);
    expect(c.showReg).toBe(false);
    expect(c.workDone[0]).toBe("New pads");
    expect(c.workDone).toHaveLength(2); // dedupe and drop junk
    expect(c.workDone[1]!.length).toBeLessThanOrEqual(MAX_WORK_LINE);
    expect(c.note).toBe("hi there");
  });
});

describe("parseConfigInput", () => {
  const ok = (body: unknown) => {
    const r = parseConfigInput(body);
    if (!r.ok) throw new Error(`expected ok: ${r.error}`);
    return r.config;
  };
  const bad = (body: unknown) => {
    const r = parseConfigInput(body);
    expect(r.ok, JSON.stringify(body)).toBe(false);
    return r.ok ? "" : r.error;
  };

  it("needs a real true/false for published", () => {
    for (const b of [null, "x", [], {}, { published: "yes" }, { published: 1 }]) bad(b);
    expect(ok({ published: false }).published).toBe(false);
  });

  it("fills in the defaults for anything not sent", () => {
    expect(ok({ published: true })).toEqual({ published: true, showReg: true, showMot: true, showUlez: true, showMarket: false, workDone: [], note: "" });
  });

  it("insists the other switches are true or false too", () => {
    for (const key of ["showReg", "showMot", "showUlez", "showMarket"]) expect(bad({ published: true, [key]: "no" })).toContain(key);
  });

  it("accepts up to the limit of lines, and says so when there are too many or one is too long", () => {
    expect(ok({ published: true, workDone: Array.from({ length: MAX_WORK_LINES }, (_, i) => `Line ${i}`) }).workDone).toHaveLength(MAX_WORK_LINES);
    expect(bad({ published: true, workDone: Array.from({ length: MAX_WORK_LINES + 1 }, (_, i) => `Line ${i}`) })).toContain(`${MAX_WORK_LINES} lines`);
    expect(bad({ published: true, workDone: ["x".repeat(MAX_WORK_LINE + 1)] })).toContain("characters");
    expect(bad({ published: true, workDone: "not a list" })).toContain("list");
    expect(bad({ published: true, workDone: ["ok", 5] })).toContain("list");
  });

  it("ignores blank and repeated lines rather than counting them", () => {
    expect(ok({ published: true, workDone: ["New pads", "  ", "NEW PADS", "Valet"] }).workDone).toEqual(["New pads", "Valet"]);
  });

  it("caps the note and needs it to be text", () => {
    expect(ok({ published: true, note: "x".repeat(MAX_NOTE) }).note).toHaveLength(MAX_NOTE);
    expect(bad({ published: true, note: "x".repeat(MAX_NOTE + 1) })).toContain("characters");
    expect(bad({ published: true, note: 5 })).toContain("text");
  });

  it("flattens what was typed", () => {
    expect(ok({ published: true, note: "line one\n\nline two", workDone: ["a\nb"] })).toMatchObject({ note: "line one line two", workDone: ["a b"] });
  });
});

describe("suggestWorkDone", () => {
  const jobs = [
    { vehicleId: "v1", status: "done", title: "Fit new front brake pads" },
    { vehicleId: "v1", status: "todo", title: "Not finished yet" },
    { vehicleId: "v2", status: "done", title: "Another car's job" },
    { vehicleId: "v1", status: "DONE", title: "Full valet" },
  ];
  const costs = [
    { vehicleId: "v1", type: "parts", label: "Brake discs", amount: 240 },
    { vehicleId: "v1", type: "tyres", label: "Two new tyres", amount: 120 },
    { vehicleId: "v1", type: "purchase", label: "Bought at auction", amount: 5000 },
    { vehicleId: "v1", type: "advertising", label: "Ad on AutoTrader", amount: 30 },
    { vehicleId: "v2", type: "parts", label: "Another car's part", amount: 10 },
    { vehicleId: "v1", type: "parts", label: "", amount: 10 },
  ];

  it("offers this car's finished jobs, then its labelled parts and work", () => {
    expect(suggestWorkDone(jobs, costs, "v1")).toEqual(["Fit new front brake pads", "Full valet", "Brake discs", "Two new tyres"]);
  });

  it("leaves out unfinished jobs, other cars, and costs that are about the deal, not the car", () => {
    const text = suggestWorkDone(jobs, costs, "v1").join(" ");
    for (const nope of ["Not finished yet", "Another car", "Bought at auction", "AutoTrader"]) expect(text).not.toContain(nope);
  });

  it("never carries an amount", () => {
    const text = suggestWorkDone(jobs, costs, "v1").join(" ");
    for (const amount of ["240", "120", "£"]) expect(text).not.toContain(amount);
  });

  it("removes repeats, caps the list, and copes with junk", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ vehicleId: "v1", status: "done", title: `Job number ${i}` }));
    expect(suggestWorkDone(many, [], "v1")).toHaveLength(MAX_WORK_LINES);
    expect(suggestWorkDone([{ vehicleId: "v1", status: "done", title: "Valet" }, { vehicleId: "v1", status: "done", title: "valet" }], [], "v1")).toEqual(["Valet"]);
    expect(suggestWorkDone("nope", { a: 1 }, "v1")).toEqual([]);
    expect(suggestWorkDone([null, 3, {}], [null], "v1")).toEqual([]);
  });
});

describe("passportImages", () => {
  it("keeps hosted https photos and small inline jpeg, png and webp", () => {
    const small = "data:image/png;base64,AAAA";
    expect(passportImages(["https://api.example.test/photos/a.jpg", small, "data:image/jpeg;base64,BBBB", "data:image/webp;base64,CCCC"])).toHaveLength(4);
  });

  it("accepts this app's own hosted photo from a local test setup, and only that exact shape over plain http", () => {
    const own = "http://127.0.0.1:4299/photos/3f2b8c1e-9a4d-4e7b-8c55-0d1f6a7b9e21.png";
    expect(passportImages([own, "http://localhost/photos/3f2b8c1e-9a4d-4e7b-8c55-0d1f6a7b9e21.jpg"])).toHaveLength(2);
    for (const bad of [
      "http://127.0.0.1:4299/admin",
      "http://127.0.0.1:4299/photos/notanid.png",
      "http://127.0.0.1:4299/photos/3f2b8c1e-9a4d-4e7b-8c55-0d1f6a7b9e21.svg",
      "http://127.0.0.1:4299/photos/3f2b8c1e-9a4d-4e7b-8c55-0d1f6a7b9e21.png?x=1",
      "http://127.0.0.1.evil.example/photos/3f2b8c1e-9a4d-4e7b-8c55-0d1f6a7b9e21.png",
      "http://192.168.1.5/photos/3f2b8c1e-9a4d-4e7b-8c55-0d1f6a7b9e21.png",
    ]) {
      expect(passportImages([bad]), bad).toEqual([]);
    }
  });

  it("refuses anything else: plain http, script links, svg, other schemes, non-text", () => {
    for (const bad of [
      "http://example.test/a.jpg",
      "javascript:alert(1)",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "data:text/html;base64,PGgxPg==",
      "ftp://example.test/a.jpg",
      "//example.test/a.jpg",
      "/photos/a.jpg",
      "https://example.test/a b.jpg",
      "https://example.test/a\".jpg",
      42,
      null,
      {},
    ]) {
      expect(passportImages([bad]), String(bad)).toEqual([]);
    }
  });

  it("leaves out an inline photo that is too big, and stops at a total", () => {
    const huge = `data:image/jpeg;base64,${"A".repeat(400_001)}`;
    expect(passportImages([huge, "https://api.example.test/photos/a.jpg"])).toEqual(["https://api.example.test/photos/a.jpg"]);
    const big = `data:image/jpeg;base64,${"A".repeat(390_000)}`;
    expect(passportImages([big, big, big, big, big])).toHaveLength(3); // 3 x 390k fits within the 1.5m total, a 4th doesn't
  });

  it("shows at most ten, and copes with a missing list", () => {
    expect(passportImages(Array.from({ length: 30 }, (_, i) => `https://api.example.test/photos/${i}.jpg`))).toHaveLength(MAX_IMAGES);
    expect(passportImages(null)).toEqual([]);
    expect(passportImages("x")).toEqual([]);
  });
});

describe("motSection", () => {
  const withMot = (mot: unknown) => ({ id: "v", mot });

  it("says nothing when no MOT was ever looked up", () => {
    for (const v of [{}, withMot(undefined), withMot({}), withMot({ expiry: "", history: [] }), withMot({ history: [{}] }), withMot("nope")]) {
      expect(motSection(v as never, NOW)).toBeUndefined();
    }
  });

  it("says valid with the days left, or expired", () => {
    expect(motSection(withMot({ expiry: dayOffset(30) }), NOW)).toMatchObject({ state: "valid", daysLeft: 30, expiry: dayOffset(30) });
    expect(motSection(withMot({ expiry: dayOffset(0) }), NOW)).toMatchObject({ state: "valid", daysLeft: 0 });
    const expired = motSection(withMot({ expiry: dayOffset(-1) }), NOW)!;
    expect(expired.state).toBe("expired");
    expect(expired).not.toHaveProperty("daysLeft");
  });

  it("gives just the history, without a state it can't back up, when there's no expiry", () => {
    const m = motSection(withMot({ history: [{ date: "2029-01-01", result: "PASSED" }] }), NOW)!;
    expect(m.state).toBe("unknown");
    expect(m.tests).toHaveLength(1);
  });

  it("lists the tests newest first, with each result, mileage and notes", () => {
    const m = motSection(
      withMot({
        expiry: dayOffset(100),
        history: [
          { date: "2027-05-01", result: "Passed", mileage: 20000.4, advisories: ["Tyre wearing"], failures: [] },
          { date: "2029-05-01", result: "FAILED", mileage: 40000, advisories: [], failures: ["Brake pad thickness"] },
          { date: "2028-05-01", result: "PASSED", advisories: ["Oil leak"], failures: [] },
        ],
      }),
      NOW
    )!;
    expect(m.tests.map(t => t.date)).toEqual(["2029-05-01", "2028-05-01", "2027-05-01"]);
    expect(m.tests[0]).toMatchObject({ result: "fail", mileage: 40000, failures: ["Brake pad thickness"] });
    expect(m.tests[1]).toMatchObject({ result: "pass", advisories: ["Oil leak"] });
    expect(m.tests[1]).not.toHaveProperty("mileage"); // not recorded, not made up
    expect(m.tests[2]!.mileage).toBe(20000);
  });

  it("never passes on a test number", () => {
    const m = motSection(withMot({ history: [{ date: "2029-05-01", result: "PASSED", testNumber: "SECRET-TESTNUM", extra: "SECRET-TESTNUM" }] }), NOW)!;
    expect(JSON.stringify(m)).not.toContain("SECRET-TESTNUM");
  });

  it("reads other date shapes, falls back to the year, and drops empty rows", () => {
    const m = motSection(
      withMot({ history: [{ date: "2029-05-01T10:00:00.000Z", result: "PASSED" }, { year: 2024, result: "PASSED" }, { date: "not a date" }, { result: "weird" }, {}, null] }),
      NOW
    )!;
    expect(m.tests.map(t => t.date ?? t.year)).toEqual(["2029-05-01", 2024]);
  });

  it("caps the tests and the notes on each, and flattens the words", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({ date: `20${10 + i}-01-01`, result: "PASSED", advisories: Array.from({ length: 12 }, (_, k) => `Advisory ${k}\nwith a break`) }));
    const m = motSection(withMot({ history }), NOW)!;
    expect(m.tests).toHaveLength(MAX_MOT_TESTS);
    expect(m.tests[0]!.advisories).toHaveLength(6);
    expect(m.tests[0]!.advisories[0]).toBe("Advisory 0 with a break");
  });

  it("ignores a negative or non-numeric mileage", () => {
    const m = motSection(withMot({ history: [{ date: "2029-01-01", result: "PASSED", mileage: -5 }, { date: "2028-01-01", result: "PASSED", mileage: "lots" }] }), NOW)!;
    for (const t of m.tests) expect(t).not.toHaveProperty("mileage");
  });
});

describe("marketSection", () => {
  const snap = (over: Record<string, unknown> = {}) => ({
    make: "Ford",
    model: "Fiesta",
    avgPrice: 9000,
    lowPrice: 6000,
    highPrice: 12000,
    sampleSize: 14,
    capturedAt: `${dayOffset(-3)}T09:00:00Z`,
    ...over,
  });

  it("compares the asking price with the average for that make and model", () => {
    expect(marketSection(car(), 8495, [snap()], NOW)).toEqual({
      averageAsking: 9000,
      lowest: 6000,
      highest: 12000,
      listings: 14,
      checkedOn: dayOffset(-3),
      difference: -505,
      basis: "make and model",
    });
    expect(marketSection(car(), 9600, [snap()], NOW)!.difference).toBe(600); // above the average is reported too
  });

  it("needs an asking price to compare", () => {
    for (const asking of [null, 0, -5]) expect(marketSection(car(), asking, [snap()], NOW)).toBeUndefined();
  });

  it("needs enough listings, and recent ones", () => {
    expect(marketSection(car(), 8495, [snap({ sampleSize: MIN_MARKET_LISTINGS - 1 })], NOW)).toBeUndefined();
    expect(marketSection(car(), 8495, [snap({ sampleSize: MIN_MARKET_LISTINGS })], NOW)).toBeDefined();
    expect(marketSection(car(), 8495, [snap({ capturedAt: `${dayOffset(-MAX_MARKET_AGE_DAYS)}T00:00:00Z` })], NOW)).toBeDefined();
    expect(marketSection(car(), 8495, [snap({ capturedAt: `${dayOffset(-MAX_MARKET_AGE_DAYS - 1)}T00:00:00Z` })], NOW)).toBeUndefined();
  });

  it("matches the make and model however they're capitalised, and never another model", () => {
    expect(marketSection(car({ make: " FORD ", model: "fiesta" }), 8495, [snap()], NOW)).toBeDefined();
    expect(marketSection(car({ model: "Focus" }), 8495, [snap()], NOW)).toBeUndefined();
    expect(marketSection(car({ make: "" }), 8495, [snap({ make: "" })], NOW)).toBeUndefined();
  });

  it("uses the most recent check", () => {
    const m = marketSection(car(), 8495, [snap({ avgPrice: 5000, capturedAt: `${dayOffset(-20)}T00:00:00Z` }), snap({ avgPrice: 9100, capturedAt: `${dayOffset(-2)}T00:00:00Z` })], NOW)!;
    expect(m.averageAsking).toBe(9100);
  });

  it("leaves out a range it wasn't given, and junk snapshots", () => {
    const m = marketSection(car(), 8495, [snap({ lowPrice: undefined, highPrice: 0 })], NOW)!;
    expect(m).not.toHaveProperty("lowest");
    expect(m).not.toHaveProperty("highest");
    expect(marketSection(car(), 8495, [null, 3, { avgPrice: "x" }, snap({ avgPrice: 0 }), snap({ capturedAt: "nope" })], NOW)).toBeUndefined();
    expect(marketSection(car(), 8495, "not a list", NOW)).toBeUndefined();
  });

  it("won't use a check dated in the future", () => {
    expect(marketSection(car(), 8495, [snap({ capturedAt: `${dayOffset(30)}T00:00:00Z` })], NOW)).toBeUndefined();
  });
});

describe("buildPublicPassport", () => {
  const AVAILABLE = (p: ReturnType<typeof build>) => {
    if (p.sold) throw new Error("expected an available car");
    return p;
  };

  it("gives a buyer what they need to know about the car", () => {
    const p = AVAILABLE(build());
    expect(p.car).toEqual({ id: "v1", year: 2019, make: "Ford", model: "Fiesta", mileage: 42000, colour: "Blue", reg: "AB12 CDE", fuelType: "PETROL", askingPrice: 8495, images: ["https://api.example.test/photos/aaa.jpg"] });
    expect(p.dealer).toEqual({ name: "Sam's Motors", phone: "01234 567890", address: "1 High Street" });
    expect(p.mot).toMatchObject({ state: "valid", expiry: "2030-09-01" });
    expect(p.emissions).toEqual({ fuelType: "PETROL", euroStatus: "Euro 6" });
    expect(p.generatedAt).toBe(new Date(NOW).toISOString());
  });

  it("NEVER includes what the dealer paid, the expected sale, notes, the customer, the VIN, test numbers or the dealership's billing details", () => {
    for (const p of [build(), build({ showMarket: true, showReg: true, workDone: ["New pads"], note: "Lovely" }), build({ published: true }, car({ status: "sold" }))]) {
      const json = JSON.stringify(p);
      for (const secret of SECRETS) expect(json, `must not contain ${secret}`).not.toContain(secret);
      for (const field of ["buyPrice", "purchasePrice", "expectedSale", "sellPrice", "notes", "vin", "customerName", "testNumber", "stripeCustomerId", "inviteEpoch"]) {
        expect(json, field).not.toContain(`"${field}"`);
      }
    }
  });

  it("shows the ASKING price only: never a sale price, and 'price on request' when there isn't one", () => {
    expect(AVAILABLE(build({}, car({ priceRetail: undefined }))).car.askingPrice).toBeNull(); // sellPrice is 777777 but must not be used
    expect(AVAILABLE(build({}, car({ priceRetail: 0 }))).car.askingPrice).toBeNull();
    expect(AVAILABLE(build({}, car({ priceRetail: "cheap" }))).car.askingPrice).toBeNull();
    expect(AVAILABLE(build({}, car({ priceRetail: 8494.6 }))).car.askingPrice).toBe(8495);
  });

  it("a sold car becomes a plain 'sold' card with nothing else on it", () => {
    const p = build({}, car({ status: "SOLD" }));
    expect(p.sold).toBe(true);
    expect(p).toEqual({ sold: true, dealer: { name: "Sam's Motors", phone: "01234 567890", address: "1 High Street" }, car: { year: 2019, make: "Ford", model: "Fiesta" } });
    expect(isSoldVehicle(car({ status: "Sold" }))).toBe(true);
    expect(isSoldVehicle(car({ status: "in stock" }))).toBe(false);
  });

  it("hides the registration unless the dealer shows it", () => {
    expect(AVAILABLE(build({ showReg: false })).car).not.toHaveProperty("reg");
  });

  it("leaves the MOT out when the dealer hides it, or when there is none to show", () => {
    expect(build({ showMot: false })).not.toHaveProperty("mot");
    expect(build({}, car({ mot: { expiry: "", history: [] } }))).not.toHaveProperty("mot");
  });

  it("leaves emissions out when hidden or when the fuel type isn't known, and doesn't invent a Euro standard", () => {
    expect(build({ showUlez: false })).not.toHaveProperty("emissions");
    expect(build({}, car({ mot: { fuelType: "" } }))).not.toHaveProperty("emissions");
    expect(AVAILABLE(build({}, car({ mot: { fuelType: "DIESEL" } }))).emissions).toEqual({ fuelType: "DIESEL" });
  });

  it("only compares with the market when the dealer has switched that on", () => {
    const snapshots = [{ make: "Ford", model: "Fiesta", avgPrice: 9000, sampleSize: 14, capturedAt: `${dayOffset(-2)}T00:00:00Z` }];
    expect(build({ showMarket: false }, car(), snapshots)).not.toHaveProperty("market");
    expect(AVAILABLE(build({ showMarket: true }, car(), snapshots)).market).toMatchObject({ averageAsking: 9000, difference: -505 });
  });

  it("includes the dealer's own lines and note, and only when they wrote something", () => {
    const p = AVAILABLE(build({ workDone: ["New front brake pads and discs", "Full valet"], note: "One careful owner, service history in the glovebox." }));
    expect(p.workDone).toEqual(["New front brake pads and discs", "Full valet"]);
    expect(p.note).toBe("One careful owner, service history in the glovebox.");
    expect(AVAILABLE(build())).not.toHaveProperty("note");
    expect(AVAILABLE(build()).workDone).toEqual([]);
  });

  it("flattens and caps what a record contains", () => {
    const p = AVAILABLE(build({}, car({ make: "Ford\n<b>x</b>", model: "M".repeat(200), colour: "Blue\nRed", reg: "AB12\nCDE" })));
    expect(p.car.make).toBe("Ford <b>x</b>"); // shown as plain text by the page
    expect(p.car.model.length).toBeLessThanOrEqual(40);
    expect(p.car.colour).toBe("Blue Red");
    expect(p.car.reg).toBe("AB12 CDE");
  });

  it("ignores a year or mileage that can't be true", () => {
    for (const year of [1800, 2500, 2019.5, "2019", null]) expect(AVAILABLE(build({}, car({ year }))).car, String(year)).not.toHaveProperty("year");
    for (const mileage of [-1, "lots", null]) expect(AVAILABLE(build({}, car({ mileage }))).car, String(mileage)).not.toHaveProperty("mileage");
  });

  it("copes with a badly damaged record without throwing", () => {
    expect(() => build({}, {} as never)).not.toThrow();
    expect(() => build({}, { mot: "x", images: 5, priceRetail: {}, make: 3 } as never)).not.toThrow();
    expect(() => buildPublicPassport({ dealership: {}, vehicle: {}, config: published, snapshots: undefined, now: NOW })).not.toThrow();
    expect(buildPublicPassport({ dealership: {}, vehicle: {}, config: published, snapshots: [], now: NOW }).dealer.name).toBe("This dealership");
  });
});
