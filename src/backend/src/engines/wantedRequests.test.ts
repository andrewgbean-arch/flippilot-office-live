import { describe, it, expect } from "vitest";
import {
  ARRIVAL_TITLE,
  MAX_ANNOUNCED_PER_REQUEST,
  MAX_ARRIVAL_NOTICES,
  MAX_BUDGET,
  MAX_MAKE_CHARS,
  MAX_WANTED_NOTE_CHARS,
  MIN_BUDGET,
  RETENTION_DAYS,
  consentWording,
  findRepeat,
  matchesFor,
  orderForStaff,
  arrivalNotices,
  parseWantedInput,
  planArrivals,
  wantedSummary,
  withoutExpired,
  type Arrival,
  type WantedRequest,
} from "./wantedRequests";

const good = (over: Record<string, unknown> = {}) => ({
  consent: true,
  name: "Priya Shah",
  email: "priya@example.co.uk",
  make: "Ford",
  model: "Fiesta",
  maxPrice: 8000,
  note: "Automatic if possible",
  ...over,
});

const parsed = (over: Record<string, unknown> = {}) => parseWantedInput(good(over));

describe("what a stranger may send", () => {
  it("keeps what was asked for, cleaned", () => {
    expect(parsed()).toEqual({
      ok: true,
      value: { name: "Priya Shah", email: "priya@example.co.uk", make: "Ford", model: "Fiesta", maxPrice: 8000, note: "Automatic if possible" },
    });
  });

  it("only accepts a genuine yes, never a missing one, a string or a truthy stand-in", () => {
    for (const consent of [undefined, false, "true", "yes", 1, null, {}]) {
      const r = parsed({ consent });
      expect(r.ok, String(consent)).toBe(false);
    }
    const r = parsed({ consent: false });
    expect(r.ok === false && r.error).toMatch(/tick the box/);
  });

  it("needs a name", () => {
    for (const name of [undefined, "", "   ", 42]) expect(parsed({ name }).ok, String(name)).toBe(false);
  });

  it("needs a phone number or an email, and either alone is enough", () => {
    expect(parsed({ email: undefined }).ok).toBe(false);
    expect(parsed({ email: undefined, phone: "07700 900123" }).ok).toBe(true);
    expect(parsed({ phone: "07700 900123", email: undefined })).toMatchObject({ ok: true, value: { phone: "07700 900123" } });
    expect(parsed({ email: "n/a" }).ok).toBe(false); // a placeholder is nothing at all
    expect(parsed({ email: "n/a", phone: "07700 900123" }).ok).toBe(true);
  });

  it("refuses a contact detail that isn't one, with advice", () => {
    const badEmail = parsed({ email: "not an email" });
    expect(badEmail.ok === false && badEmail.error).toMatch(/name@example\.com/);
    const badPhone = parsed({ email: undefined, phone: "12" });
    expect(badPhone.ok === false && badPhone.error).toMatch(/at least 5 digits/);
    // a phone number that isn't one is refused even when a good email was also given,
    // rather than quietly kept as a number the dealer can't ring
    const badPhoneGoodEmail = parsed({ phone: "12" });
    expect(badPhoneGoodEmail.ok === false && badPhoneGoodEmail.error).toMatch(/at least 5 digits/);
    // an address that could add a cc or a subject to the dealer's email link
    expect(parsed({ email: "a@b.com?cc=someone@else.com" }).ok).toBe(false);
  });

  it("needs a make, or a few words about what they're after", () => {
    expect(parsed({ make: undefined, model: undefined, note: undefined }).ok).toBe(false);
    expect(parsed({ make: undefined, model: undefined })).toMatchObject({ ok: true, value: { note: "Automatic if possible" } });
    expect(parsed({ model: undefined })).toMatchObject({ ok: true });
  });

  it("won't take a model without its make", () => {
    const r = parsed({ make: undefined });
    expect(r.ok === false && r.error).toMatch(/make as well as the model/);
  });

  describe("the budget", () => {
    it("is whole pounds, read from a number or from what a person types", () => {
      expect(parsed({ maxPrice: "£8,000" })).toMatchObject({ value: { maxPrice: 8000 } });
      expect(parsed({ maxPrice: " 8 000 " })).toMatchObject({ value: { maxPrice: 8000 } });
      expect(parsed({ maxPrice: 7999.6 })).toMatchObject({ value: { maxPrice: 8000 } });
    });

    it("is optional: blank or missing means no limit", () => {
      for (const maxPrice of [undefined, null, "", "  ", "£"]) {
        const r = parsed({ maxPrice });
        expect(r.ok && "maxPrice" in r.value, String(maxPrice)).toBe(false);
        expect(r.ok, String(maxPrice)).toBe(true);
      }
    });

    it("must be sensible, and the limits themselves are allowed", () => {
      expect(parsed({ maxPrice: MIN_BUDGET }).ok).toBe(true);
      expect(parsed({ maxPrice: MAX_BUDGET }).ok).toBe(true);
      for (const maxPrice of [MIN_BUDGET - 1, MAX_BUDGET + 1, 0, -5000, "lots", "8k", NaN, Infinity, true, {}, [8000]]) {
        const r = parsed({ maxPrice });
        expect(r.ok, String(maxPrice)).toBe(false);
      }
      const r = parsed({ maxPrice: 100 });
      expect(r.ok === false && r.error).toMatch(/£500 and £500,000/);
    });
  });

  describe("text is cleaned and capped before it is kept", () => {
    it("flattens line breaks and control characters", () => {
      const r = parsed({ name: "Priya\nShah\u0000", make: "Ford\r\n", note: "line one\nline two\ttabbed" });
      expect(r).toMatchObject({ ok: true, value: { name: "Priya Shah", make: "Ford", note: "line one line two tabbed" } });
    });

    it("cuts over-long text instead of storing it", () => {
      const r = parsed({ make: "M".repeat(500), model: undefined, note: "n".repeat(5000), name: "N".repeat(500) });
      expect(r.ok && r.value.make?.length).toBe(MAX_MAKE_CHARS);
      expect(r.ok && r.value.note?.length).toBe(MAX_WANTED_NOTE_CHARS);
      expect(r.ok && r.value.name.length).toBeLessThanOrEqual(80);
    });

    it("keeps markup as plain text, to be escaped where it's shown", () => {
      const r = parsed({ note: "<script>alert(1)</script>" });
      expect(r).toMatchObject({ ok: true, value: { note: "<script>alert(1)</script>" } });
    });

    it("survives anything else a stranger can post", () => {
      for (const body of [null, undefined, "hello", 5, [], [1, 2], () => 1]) {
        expect(parseWantedInput(body).ok, String(body)).toBe(false);
      }
      expect(parseWantedInput({ consent: true, name: { a: 1 }, email: ["x"], make: 7 }).ok).toBe(false);
    });
  });
});

describe("the words the person agrees to", () => {
  it("name the dealer and say how long the details are kept, and that they can be deleted", () => {
    const w = consentWording("Sam's Motors");
    expect(w).toContain("Sam's Motors");
    expect(w).toContain("12 months");
    expect(w).toContain("delete");
    expect(RETENTION_DAYS).toBe(365); // "12 months" above must stay true
  });

  it("copes with a dealer name that is empty or full of line breaks", () => {
    expect(consentWording("")).toContain("this dealer");
    expect(consentWording("Sam's\nMotors")).toContain("Sam's Motors");
  });
});

const car = (id: string, make: unknown, model: unknown, priceRetail: unknown = 7000, year: unknown = 2019) => ({ id, make, model, priceRetail, year });

describe("matching a request against stock", () => {
  const stock = [
    car("fiesta", "Ford", "Fiesta ST-Line", 7995),
    car("focus", "Ford", "Focus", 9500),
    car("golf", "Volkswagen", "Golf GTI", 12000),
    car("a3", "Audi", "A3 Sportback", 11000),
    car("a30", "Audi", "A30", 3000),
    car("mb", "Mercedes-Benz", "A Class", 15000),
    car("bmw", "BMW", "1-Series 118d", 10000),
    car("noprice", "Ford", "Fiesta", null),
  ];
  const ids = (r: Parameters<typeof matchesFor>[0]) => matchesFor(r, stock).map(m => m.vehicleId);

  it("finds every car of a make when no model was asked for", () => {
    expect(ids({ make: "ford" })).toEqual(["fiesta", "focus", "noprice"]);
  });

  it("ignores case, spaces and punctuation in the make", () => {
    expect(ids({ make: "MERCEDES BENZ" })).toEqual(["mb"]);
    expect(ids({ make: "mercedes-benz" })).toEqual(["mb"]);
    expect(ids({ make: "Merc" })).toEqual([]);
  });

  it("matches a model that starts with what was asked, word for word", () => {
    expect(ids({ make: "Ford", model: "Fiesta" })).toEqual(["fiesta", "noprice"]);
    expect(ids({ make: "Volkswagen", model: "golf" })).toEqual(["golf"]);
    expect(ids({ make: "Audi", model: "A3" })).toEqual(["a3"]); // never an A30
    expect(ids({ make: "BMW", model: "1 series" })).toEqual(["bmw"]);
  });

  it("does not match when more was asked for than the car says", () => {
    expect(ids({ make: "Ford", model: "Fiesta ST-Line Edition" })).toEqual([]);
  });

  it("never matches a request that named no make: the dealer reads those", () => {
    expect(ids({})).toEqual([]);
    expect(matchesFor({ model: "Fiesta" }, stock)).toEqual([]);
  });

  it("says how far over budget a car is, only when it is", () => {
    const over = matchesFor({ make: "Ford", model: "Fiesta", maxPrice: 7000 }, stock);
    expect(over.find(m => m.vehicleId === "fiesta")).toMatchObject({ price: 7995, overBudgetBy: 995 });
    const exact = matchesFor({ make: "Ford", model: "Fiesta", maxPrice: 7995 }, stock);
    expect(exact.find(m => m.vehicleId === "fiesta")).not.toHaveProperty("overBudgetBy");
  });

  it("doesn't judge a car with no price against the budget", () => {
    const m = matchesFor({ make: "Ford", model: "Fiesta", maxPrice: 1000 }, stock).find(x => x.vehicleId === "noprice");
    expect(m).toMatchObject({ price: null });
    expect(m).not.toHaveProperty("overBudgetBy");
  });

  it("labels a car with its year, make and model", () => {
    expect(matchesFor({ make: "Volkswagen" }, stock)[0]?.label).toBe("2019 Volkswagen Golf GTI");
    expect(matchesFor({ make: "Ford" }, [car("x", "Ford", "Ka", 500, null)])[0]?.label).toBe("Ford Ka");
  });

  it("never matches on a make that is only punctuation, even against a car with no make", () => {
    expect(matchesFor({ make: "---" }, [car("x", "", ""), car("y", "---", ""), car("z", undefined, undefined)])).toEqual([]);
  });

  it("treats a price of nothing as no price rather than as free", () => {
    const m = matchesFor({ make: "Ford", maxPrice: 1000 }, [car("z", "Ford", "Ka", 0)])[0];
    expect(m).toMatchObject({ price: null });
    expect(m).not.toHaveProperty("overBudgetBy");
  });

  it("copes with stock records that are missing or junk", () => {
    const junk = [car("j1", undefined, undefined), car("j2", 7, {}), car("j3", "Ford", null, "cheap", "old"), car("j4", "Ford", "Ka", 0)];
    expect(() => matchesFor({ make: "Ford" }, junk)).not.toThrow();
    expect(matchesFor({ make: "Ford" }, junk).map(m => m.vehicleId)).toEqual(["j3", "j4"]);
    expect(matchesFor({ make: "Ford" }, junk)[0]).toMatchObject({ price: null });
  });
});

describe("forgetting requests after the retention period", () => {
  const DAY = 86_400_000;
  const now = Date.parse("2030-06-01T12:00:00.000Z");
  const asked = (daysAgo: number) => ({ askedAt: new Date(now - daysAgo * DAY).toISOString() });

  it("keeps a request up to the last day and lets go of it on the day it runs out", () => {
    expect(withoutExpired([asked(RETENTION_DAYS - 1)], now)).toHaveLength(1);
    expect(withoutExpired([asked(RETENTION_DAYS - 0.001)], now)).toHaveLength(1);
    expect(withoutExpired([asked(RETENTION_DAYS)], now)).toHaveLength(0);
    expect(withoutExpired([asked(RETENTION_DAYS + 1)], now)).toHaveLength(0);
  });

  it("drops a request whose date can't be read, rather than keeping it for ever", () => {
    expect(withoutExpired([{ askedAt: "" }, { askedAt: "yesterday" }, { askedAt: undefined as unknown as string }], now)).toEqual([]);
  });

  it("keeps everything recent, in order", () => {
    const list = [{ ...asked(1), id: "a" }, { ...asked(400), id: "b" }, { ...asked(30), id: "c" }];
    expect(withoutExpired(list, now).map(r => r.id)).toEqual(["a", "c"]);
  });
});

// `over` may set an optional field to undefined (to say "this person gave no phone").
const request = (over: Partial<Record<keyof WantedRequest, unknown>> = {}): WantedRequest => ({
  id: "r1",
  name: "Priya Shah",
  email: "priya@example.co.uk",
  make: "Ford",
  model: "Fiesta",
  status: "waiting",
  consent: { at: "2030-01-01T00:00:00.000Z", wording: "yes" },
  createdAt: "2030-01-01T00:00:00.000Z",
  askedAt: "2030-01-01T00:00:00.000Z",
  ...(over as Partial<WantedRequest>),
});

describe("the same person asking again", () => {
  const input = { name: "Priya S", email: "PRIYA@example.co.uk", make: "ford", model: "fiesta" };

  it("is recognised by email, ignoring case", () => {
    expect(findRepeat([request()], input)?.id).toBe("r1");
  });

  it("is recognised by phone number however it is written", () => {
    const r = request({ email: undefined, phone: "07700 900123" });
    expect(findRepeat([r], { name: "P", phone: "07700-900-123", make: "Ford", model: "Fiesta" })?.id).toBe("r1");
  });

  it("is not another person, another car, or a request already closed", () => {
    expect(findRepeat([request()], { ...input, email: "someone@else.com" })).toBeUndefined();
    expect(findRepeat([request()], { ...input, model: "Focus" })).toBeUndefined();
    expect(findRepeat([request()], { ...input, make: "Audi" })).toBeUndefined();
    expect(findRepeat([request({ status: "closed" })], input)).toBeUndefined();
  });

  it("treats a request with no model as different from one with a model", () => {
    const { model: _m, ...noModel } = input;
    expect(findRepeat([request()], noModel)).toBeUndefined();
    expect(findRepeat([request({ model: undefined })], noModel)?.id).toBe("r1");
  });

  it("never treats two people with no contact in common as the same", () => {
    expect(findRepeat([request({ email: undefined, phone: undefined })], { name: "x", make: "Ford", model: "Fiesta", phone: "07700 900123" })).toBeUndefined();
  });
});

describe("the one-line summary for a notification", () => {
  it("says what they want and their budget, never who they are", () => {
    const line = wantedSummary({ make: "Ford", model: "Fiesta", maxPrice: 8000 });
    expect(line).toBe("Ford Fiesta, up to £8,000");
    expect(wantedSummary({ ...request(), name: "Priya Shah" } as never)).not.toContain("Priya");
  });

  it("falls back to their own words, then to 'a car'", () => {
    expect(wantedSummary({ note: "a small automatic" })).toBe("a small automatic");
    expect(wantedSummary({ note: "a small automatic", maxPrice: 6000 })).toBe("a small automatic, up to £6,000");
    expect(wantedSummary({})).toBe("a car");
  });
});

describe("the order the dealer sees them in", () => {
  const item = (id: string, status: WantedRequest["status"], matches: number, askedAt: string) => ({ id, status, matches: new Array(matches).fill(0), askedAt });

  it("puts people waiting for a car you have first, then the rest waiting, then contacted, then closed", () => {
    const list = [
      item("closed-new", "closed", 1, "2030-05-05T00:00:00Z"),
      item("waiting-no-match", "waiting", 0, "2030-05-04T00:00:00Z"),
      item("contacted", "contacted", 2, "2030-05-03T00:00:00Z"),
      item("waiting-match", "waiting", 1, "2030-01-01T00:00:00Z"),
    ];
    expect(orderForStaff(list).map(i => i.id)).toEqual(["waiting-match", "waiting-no-match", "contacted", "closed-new"]);
  });

  it("puts the newest first within a group, and doesn't change the list it was given", () => {
    const list = [item("old", "waiting", 0, "2030-01-01T00:00:00Z"), item("new", "waiting", 0, "2030-03-01T00:00:00Z")];
    const copy = [...list];
    expect(orderForStaff(list).map(i => i.id)).toEqual(["new", "old"]);
    expect(list).toEqual(copy);
  });
});

describe("telling the team when a car arrives", () => {
  const stock = [car("fiesta", "Ford", "Fiesta", 7995), car("focus", "Ford", "Focus", 9500), car("golf", "Volkswagen", "Golf", 12000)];
  const waiting = (over: Partial<Record<keyof WantedRequest, unknown>> = {}) => request({ status: "waiting", announcedVehicleIds: [], ...over });

  it("announces a car that newly fits, with how many people are waiting, and records it", () => {
    const plan = planArrivals([waiting()], stock);
    expect(plan.changed).toBe(true);
    expect(plan.arrivals).toEqual([{ vehicleId: "fiesta", label: "2019 Ford Fiesta", price: 7995, waiting: 1 }]);
    expect(plan.requests[0]?.announcedVehicleIds).toEqual(["fiesta"]);
  });

  it("counts everyone waiting for the same car, and puts the most wanted first", () => {
    const plan = planArrivals(
      [
        waiting({ id: "a", model: "Focus" }),
        waiting({ id: "b", email: "b@example.co.uk", model: "Focus" }),
        waiting({ id: "c", email: "c@example.co.uk", model: "Fiesta" }),
      ],
      stock
    );
    // the Focus has two people waiting so it comes first, although "Fiesta" comes first alphabetically
    expect(plan.arrivals.map(a => [a.vehicleId, a.waiting])).toEqual([["focus", 2], ["fiesta", 1]]);
  });

  it("says nothing more about a car it has already announced", () => {
    const first = planArrivals([waiting()], stock);
    const again = planArrivals(first.requests, stock);
    expect(again.arrivals).toEqual([]);
    expect(again.changed).toBe(false);
    expect(again.requests).toEqual(first.requests);
  });

  it("does not announce what already fitted the first time a request is looked at, only remembers it", () => {
    const plan = planArrivals([request({ status: "waiting" })], stock); // no list of announced cars yet
    expect(plan.arrivals).toEqual([]);
    expect(plan.requests[0]?.announcedVehicleIds).toEqual(["fiesta"]);
    expect(plan.changed).toBe(true);
    // ...and a car that arrives after that is news
    const later = planArrivals(plan.requests, [...stock, car("fiesta2", "Ford", "Fiesta", 6500)]);
    expect(later.arrivals.map(a => a.vehicleId)).toEqual(["fiesta2"]);
  });

  it("only looks at people still waiting: someone already contacted or closed is left alone", () => {
    for (const status of ["contacted", "closed"]) {
      const plan = planArrivals([request({ status })], stock);
      expect(plan.arrivals, status).toEqual([]);
      expect(plan.changed, status).toBe(false);
      expect(plan.requests[0]?.announcedVehicleIds, status).toBeUndefined();
    }
  });

  it("waits for a car over their budget to come within it", () => {
    const tight = waiting({ maxPrice: 7000 });
    const over = planArrivals([tight], stock);
    expect(over.arrivals).toEqual([]);
    expect(over.changed).toBe(false);
    const cheaper = planArrivals(over.requests, [car("fiesta", "Ford", "Fiesta", 6995)]);
    expect(cheaper.arrivals.map(a => a.vehicleId)).toEqual(["fiesta"]);
    expect(planArrivals([waiting({ maxPrice: 7995 })], stock).arrivals.map(a => a.vehicleId)).toEqual(["fiesta"]); // exactly on budget fits
  });

  it("announces a car with no price yet, since it cannot be judged against a budget", () => {
    const plan = planArrivals([waiting({ maxPrice: 1000 })], [car("x", "Ford", "Fiesta", null)]);
    expect(plan.arrivals).toEqual([{ vehicleId: "x", label: "2019 Ford Fiesta", price: null, waiting: 1 }]);
  });

  it("never announces for a request that named no make: the dealer reads those", () => {
    const plan = planArrivals([waiting({ make: undefined, model: undefined, note: "a small automatic" })], stock);
    expect(plan.arrivals).toEqual([]);
    expect(plan.changed).toBe(false);
  });

  it("does not announce a car that has left the stock, and does not forget it was announced", () => {
    const plan = planArrivals([waiting({ announcedVehicleIds: ["fiesta"] })], [car("focus", "Ford", "Focus", 9500)]);
    expect(plan.arrivals).toEqual([]);
    expect(plan.changed).toBe(false);
    expect(plan.requests[0]?.announcedVehicleIds).toEqual(["fiesta"]);
  });

  it("remembers only the newest announced cars, so the list can never grow without limit", () => {
    const old = Array.from({ length: MAX_ANNOUNCED_PER_REQUEST }, (_, i) => `old${i}`);
    const plan = planArrivals([waiting({ announcedVehicleIds: old })], stock);
    const kept = plan.requests[0]?.announcedVehicleIds ?? [];
    expect(MAX_ANNOUNCED_PER_REQUEST).toBe(200);
    expect(kept).toHaveLength(200);
    expect(kept.at(-1)).toBe("fiesta");
    expect(kept[0]).toBe("old1");
  });

  it("gives back the same list, untouched, when there is nothing to do", () => {
    const list = [waiting({ announcedVehicleIds: ["fiesta"] })];
    const plan = planArrivals(list, stock);
    expect(plan.changed).toBe(false);
    expect(plan.requests).toEqual(list);
    expect(plan.requests[0]).toBe(list[0]); // the very same record
    expect(planArrivals([], stock)).toEqual({ requests: [], arrivals: [], changed: false });
  });
});

describe("what the team is told about an arrival", () => {
  const arrival = (over: Partial<Arrival> = {}): Arrival => ({ vehicleId: "v1", label: "2019 Ford Fiesta", price: 7995, waiting: 2, ...over });

  it("names the car, its price and how many are waiting, with the grammar right", () => {
    expect(arrivalNotices([arrival()])).toEqual([{ title: ARRIVAL_TITLE, message: "2019 Ford Fiesta, £7,995: 2 people are waiting for one like it." }]);
    expect(arrivalNotices([arrival({ waiting: 1 })])[0]?.message).toBe("2019 Ford Fiesta, £7,995: 1 person is waiting for one like it.");
  });

  it("leaves the price out when the car has none, and never says who is waiting", () => {
    const message = arrivalNotices([arrival({ price: null })])[0]?.message ?? "";
    expect(message).toBe("2019 Ford Fiesta: 2 people are waiting for one like it.");
    expect(message).not.toContain("£");
    expect(request().name).toBe("Priya Shah");
    expect(JSON.stringify(arrivalNotices([arrival()]))).not.toMatch(/Priya|priya|example/);
  });

  it("gives up to five separate notices, then rolls the rest into one last line", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => arrival({ vehicleId: `v${i}`, label: `Car ${i}` }));
    expect(arrivalNotices(many(5))).toHaveLength(MAX_ARRIVAL_NOTICES);
    expect(arrivalNotices(many(5)).every(n => n.message.startsWith("Car "))).toBe(true);
    const six = arrivalNotices(many(6));
    expect(six).toHaveLength(MAX_ARRIVAL_NOTICES);
    expect(six.slice(0, 4).map(n => n.message.slice(0, 5))).toEqual(["Car 0", "Car 1", "Car 2", "Car 3"]);
    expect(six[4]?.message).toBe("And 2 more cars that people are waiting for. See Sales, then Wanted Cars.");
    expect(arrivalNotices(many(40))[4]?.message).toContain("And 36 more cars");
    expect(arrivalNotices([])).toEqual([]);
  });
});
