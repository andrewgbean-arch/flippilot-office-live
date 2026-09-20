import { describe, it, expect } from "vitest";
import { applyVehicleChanges, FORBIDDEN_FIELD_NAMES, parseChanges, type VehicleChange } from "./inventoryMerge.js";

// The pure half of field-level stock saving: checking a `changes` list
// (parseChanges) and applying it onto the stored cars (applyVehicleChanges).
// No Express and no database here; inventoryChangesRoute.test.ts drives the
// same rules through the real app.

const car = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  make: "Ford",
  model: "Fiesta",
  status: "in stock",
  priceRetail: 5000,
  images: null,
  ...extra,
});

// Freezes a value and everything inside it, so ANY attempt to change it (add,
// edit or delete a field, push to a list) throws in strict mode.
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

const noneDeleted = new Set<string>();
const change = (id: string, set?: Record<string, unknown>, unset?: string[]): VehicleChange => ({
  id,
  ...(set ? { set } : {}),
  ...(unset ? { unset } : {}),
});

describe("parseChanges: what a valid `changes` looks like", () => {
  it("no changes at all is fine, and so is an empty list", () => {
    expect(parseChanges(undefined)).toEqual({ ok: true, changes: [] });
    expect(parseChanges([])).toEqual({ ok: true, changes: [] });
  });

  it("accepts set only, unset only, both, and an entry that names neither", () => {
    const raw = [{ id: "a", set: { priceRetail: 1 } }, { id: "b", unset: ["notes"] }, { id: "c", set: { x: 1 }, unset: ["y"] }, { id: "d" }];
    expect(parseChanges(raw)).toEqual({
      ok: true,
      changes: [{ id: "a", set: { priceRetail: 1 } }, { id: "b", unset: ["notes"] }, { id: "c", set: { x: 1 }, unset: ["y"] }, { id: "d" }],
    });
  });

  it("an empty set / empty unset is allowed (and kept as sent)", () => {
    expect(parseChanges([{ id: "a", set: {}, unset: [] }])).toEqual({ ok: true, changes: [{ id: "a", set: {}, unset: [] }] });
  });

  it("values are taken as they come: any JSON, including null, lists and objects", () => {
    const set = { notes: null, costs: [{ label: "tyres", amount: 80 }], mot: { expiry: "2027-01-01" }, sellPrice: 0, flag: false };
    expect(parseChanges([{ id: "a", set }])).toEqual({ ok: true, changes: [{ id: "a", set }] });
  });

  it("hands back fresh copies and drops keys it doesn't know, without touching what it was given", () => {
    const raw = deepFreeze([{ id: "a", set: { priceRetail: 1 }, unset: ["notes"], surprise: true }]);
    const parsed = parseChanges(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const [first] = parsed.changes;
    expect(first).toEqual({ id: "a", set: { priceRetail: 1 }, unset: ["notes"] });
    expect(first).not.toBe(raw[0]);
    expect(first!.set).not.toBe(raw[0]!.set);
    expect(first!.unset).not.toBe(raw[0]!.unset);
    expect("surprise" in first!).toBe(false);
  });
});

describe("parseChanges: refuses anything that isn't exactly the documented shape", () => {
  const refused = (raw: unknown) => {
    const parsed = parseChanges(raw);
    expect(parsed.ok, JSON.stringify(raw)).toBe(false);
    if (parsed.ok) return "";
    // A plain sentence, not a leaked exception or a dump of what was sent.
    expect(parsed.error).toMatch(/^\S[^]{6,}$/);
    expect(parsed.error).not.toMatch(/undefined|TypeError|\[object|stack|\bat \w+\.|node_modules/i);
    return parsed.error;
  };

  it("changes must be a list", () => {
    for (const bad of [null, "a", 5, true, {}, { 0: { id: "a" } }, { length: 0 }]) refused(bad);
  });

  it("every entry must be an object (not null, a list, or a string)", () => {
    for (const bad of [null, [], ["a"], "a", 5, true, [{ id: "a" }]]) refused([bad]);
    // one good entry does not rescue a bad neighbour, whichever side it is on
    refused([{ id: "a" }, null]);
    refused([null, { id: "a" }]);
  });

  it("an entry with a hole in the list is not skipped over", () => {
    // eslint-disable-next-line no-sparse-arrays
    refused([{ id: "a" }, , { id: "b" }]);
  });

  it("every entry needs a non-empty text id", () => {
    for (const bad of [{}, { id: "" }, { id: null }, { id: 5 }, { id: ["a"] }, { id: { a: 1 } }, { id: true }, { set: { x: 1 } }]) {
      refused([bad]);
    }
  });

  it("`set`, when present, must be an object", () => {
    for (const bad of [null, [], ["priceRetail"], "priceRetail", 5, true]) refused([{ id: "a", set: bad }]);
  });

  it("`unset`, when present, must be a list of non-empty text names", () => {
    for (const bad of [null, "notes", 5, true, {}, { 0: "notes" }, [""], [1], [null], [["notes"]], ["notes", ""], ["notes", 2], [{}]]) {
      refused([{ id: "a", unset: bad }]);
    }
    // eslint-disable-next-line no-sparse-arrays
    refused([{ id: "a", unset: [, "notes"] }]);
  });

  it("a field with an empty name can't be set", () => {
    refused([{ id: "a", set: { "": 1 } }]);
  });

  it("the forbidden names can be neither set nor unset", () => {
    expect(FORBIDDEN_FIELD_NAMES).toEqual(["id", "__proto__", "constructor", "prototype"]);
    for (const name of FORBIDDEN_FIELD_NAMES) {
      // JSON.parse makes "__proto__" a real own key (an object literal would not).
      const inSet = JSON.parse(`{"id":"a","set":{"${name}":"x"}}`);
      const inUnset = JSON.parse(`{"id":"a","unset":["${name}"]}`);
      const error = refused([inSet]);
      refused([inUnset]);
      expect(error).toContain(name);
      // ...alongside perfectly good fields, and after a perfectly good entry
      refused([{ id: "a", set: { priceRetail: 1 } }, JSON.parse(`{"id":"b","set":{"priceRetail":1,"${name}":"x"}}`)]);
      refused([{ id: "a", unset: ["notes", name] }]);
    }
  });

  it("a field named in both set and unset of one entry is refused", () => {
    refused([{ id: "a", set: { notes: "x" }, unset: ["notes"] }]);
    refused([{ id: "a", set: { priceRetail: 1, notes: "x" }, unset: ["make", "notes"] }]);
    // the same field in different entries is fine: they apply in order
    expect(parseChanges([{ id: "a", set: { notes: "x" } }, { id: "a", unset: ["notes"] }]).ok).toBe(true);
    expect(parseChanges([{ id: "a", set: { notes: "x" } }, { id: "b", unset: ["notes"] }]).ok).toBe(true);
  });

  it("a __proto__ attack in a JSON body is refused and pollutes nothing", () => {
    const body = JSON.parse('[{"id":"a","set":{"__proto__":{"polluted":"yes"}}}]');
    expect(Object.keys(body[0].set)).toEqual(["__proto__"]); // really an own key, so this is the real attack shape
    expect(parseChanges(body).ok).toBe(false);
    expect(({} as any).polluted).toBeUndefined();
  });
});

describe("applyVehicleChanges: set and unset", () => {
  it("sets fields on the named car and leaves every other field and every other car exactly as it was", () => {
    const before = [car("a", { notes: "clean", costs: [{ label: "valet", amount: 20 }] }), car("b"), car("c", { status: "sold" })];
    const snapshot = structuredClone(before);
    const out = applyVehicleChanges(before, [change("b", { priceRetail: 4500, status: "sold" })], noneDeleted);

    expect(out.changed).toBe(1);
    expect(out.notFound).toEqual([]);
    expect(out.cars).toEqual([snapshot[0], { ...snapshot[1], priceRetail: 4500, status: "sold" }, snapshot[2]]);
  });

  it("unset really removes the field: it isn't left behind as null or undefined", () => {
    const out = applyVehicleChanges([car("a", { notes: "x", sellPrice: 4000 })], [change("a", undefined, ["notes", "sellPrice"])], noneDeleted);
    const [a] = out.cars as Record<string, unknown>[];
    expect("notes" in a!).toBe(false);
    expect("sellPrice" in a!).toBe(false);
    expect(Object.keys(a!)).toEqual(["id", "make", "model", "status", "priceRetail", "images"]);
    expect(out.changed).toBe(1);
  });

  it("unsetting a field the car doesn't have is harmless", () => {
    const before = [car("a")];
    const out = applyVehicleChanges(before, [change("a", undefined, ["neverHadThis"])], noneDeleted);
    expect(out.cars).toEqual(before);
    expect(out.changed).toBe(1);
  });

  it("a set replaces the WHOLE field: lists and objects aren't merged", () => {
    const before = [car("a", { costs: [{ label: "one", amount: 1 }, { label: "two", amount: 2 }], mot: { expiry: "2026-01-01", passed: true } })];
    const out = applyVehicleChanges(before, [change("a", { costs: [{ label: "three", amount: 3 }], mot: { expiry: "2027-01-01" } })], noneDeleted);
    const [a] = out.cars as any[];
    expect(a.costs).toEqual([{ label: "three", amount: 3 }]);
    expect(a.mot).toEqual({ expiry: "2027-01-01" });
  });

  it("null, zero, false and empty text are real values that get set, not treated as 'nothing'", () => {
    const out = applyVehicleChanges([car("a", { notes: "x", sellPrice: 9, flag: true })], [change("a", { notes: "", sellPrice: 0, flag: false, images: null })], noneDeleted);
    expect(out.cars[0]).toMatchObject({ notes: "", sellPrice: 0, flag: false, images: null });
  });

  it("a set can add a field the car never had", () => {
    const out = applyVehicleChanges([car("a")], [change("a", { registrationDate: "2020-05-01" })], noneDeleted);
    expect((out.cars[0] as any).registrationDate).toBe("2020-05-01");
  });

  it("an entry naming neither set nor unset is applied as a no-op and still counts", () => {
    const before = [car("a")];
    const out = applyVehicleChanges(before, [change("a")], noneDeleted);
    expect(out.cars).toEqual(before);
    expect(out.changed).toBe(1);
  });

  it("with an unset and a set in ONE entry, both happen", () => {
    const out = applyVehicleChanges([car("a", { notes: "old", sellPrice: 1 })], [change("a", { sellPrice: 2 }, ["notes"])], noneDeleted);
    const [a] = out.cars as Record<string, unknown>[];
    expect(a).toEqual({ id: "a", make: "Ford", model: "Fiesta", status: "in stock", priceRetail: 5000, images: null, sellPrice: 2 });
  });

  it("unset is applied before set, so a set that survives is what the entry finally leaves", () => {
    // parseChanges refuses the same field in both halves; applied directly, the set must still win.
    const out = applyVehicleChanges([car("a", { notes: "old" })], [{ id: "a", set: { notes: "new" }, unset: ["notes"] }], noneDeleted);
    expect((out.cars[0] as any).notes).toBe("new");
  });

  it("keeps the car's field order, adding new fields at the end", () => {
    const out = applyVehicleChanges([car("a")], [change("a", { priceRetail: 1, brandNew: true })], noneDeleted);
    expect(Object.keys(out.cars[0] as object)).toEqual(["id", "make", "model", "status", "priceRetail", "images", "brandNew"]);
  });
});

describe("applyVehicleChanges: the id never changes", () => {
  it("ignores a set or unset of `id`, even though parseChanges refuses it before it gets here", () => {
    const before = [car("a"), car("b")];
    const out = applyVehicleChanges(before, [{ id: "a", set: { id: "b", priceRetail: 1 } }, { id: "b", unset: ["id"] }], noneDeleted);
    expect(out.cars.map(c => (c as any).id)).toEqual(["a", "b"]);
    expect((out.cars[0] as any).priceRetail).toBe(1);
    expect(out.changed).toBe(2);
  });
});

describe("applyVehicleChanges: several entries", () => {
  it("two entries for one car apply in order, the later one winning per field", () => {
    const out = applyVehicleChanges(
      [car("a")],
      [change("a", { priceRetail: 1, notes: "first" }), change("a", { priceRetail: 2 }), change("a", { notes: "third" })],
      noneDeleted
    );
    expect(out.cars[0]).toMatchObject({ priceRetail: 2, notes: "third" });
    expect(out.changed).toBe(3); // three entries were applied
  });

  it("an unset after a set removes it, and a set after an unset brings it back", () => {
    const removed = applyVehicleChanges([car("a")], [change("a", { notes: "x" }), change("a", undefined, ["notes"])], noneDeleted);
    expect("notes" in (removed.cars[0] as object)).toBe(false);

    const back = applyVehicleChanges([car("a", { notes: "old" })], [change("a", undefined, ["notes"]), change("a", { notes: "again" })], noneDeleted);
    expect((back.cars[0] as any).notes).toBe("again");
  });

  it("entries for different cars each go to their own car", () => {
    const out = applyVehicleChanges([car("a"), car("b"), car("c")], [change("c", { priceRetail: 3 }), change("a", { priceRetail: 1 })], noneDeleted);
    expect(out.cars.map(c => (c as any).priceRetail)).toEqual([1, 5000, 3]);
    expect(out.changed).toBe(2);
  });

  it("keeps the list's order and length", () => {
    const out = applyVehicleChanges([car("z"), car("a"), car("m")], [change("a", { priceRetail: 1 })], noneDeleted);
    expect(out.cars.map(c => (c as any).id)).toEqual(["z", "a", "m"]);
  });

  it("no changes: the same cars come back, as a new list", () => {
    const before = [car("a"), car("b")];
    const out = applyVehicleChanges(before, [], noneDeleted);
    expect(out).toEqual({ cars: before, changed: 0, notFound: [], imagesEdited: [] });
    expect(out.cars).not.toBe(before);
  });
});

describe("applyVehicleChanges: cars that aren't there", () => {
  it("reports an unknown id in notFound, applies nothing for it and creates nothing", () => {
    const before = [car("a")];
    const out = applyVehicleChanges(before, [change("ghost", { priceRetail: 1, make: "BMW" })], noneDeleted);
    expect(out.cars).toEqual(before);
    expect(out.changed).toBe(0);
    expect(out.notFound).toEqual(["ghost"]);
  });

  it("a mixed list applies the known ids and reports the unknown ones", () => {
    const out = applyVehicleChanges([car("a"), car("b")], [change("a", { priceRetail: 1 }), change("ghost", { priceRetail: 2 }), change("b", { priceRetail: 3 })], noneDeleted);
    expect(out.cars.map(c => (c as any).priceRetail)).toEqual([1, 3]);
    expect(out.changed).toBe(2);
    expect(out.notFound).toEqual(["ghost"]);
  });

  it("lists each unknown id once, in the order first met, however many entries name it", () => {
    const out = applyVehicleChanges(
      [car("a")],
      [change("x", { p: 1 }), change("y", { p: 1 }), change("x", { p: 2 }), change("a", { p: 3 }), change("y", undefined, ["p"]), change("x")],
      noneDeleted
    );
    expect(out.notFound).toEqual(["x", "y"]);
    expect(out.changed).toBe(1);
  });

  it("an id that is in deletedIds is skipped without a word: neither changed nor notFound", () => {
    // In the route the car has already gone from `cars` by then; and a deleted id may also still be present here.
    const gone = applyVehicleChanges([car("a")], [change("b", { p: 1 })], new Set(["b"]));
    expect(gone).toEqual({ cars: [car("a")], changed: 0, notFound: [], imagesEdited: [] });

    const stillThere = applyVehicleChanges([car("a"), car("b")], [change("b", { priceRetail: 1, images: [] }), change("a", { priceRetail: 2 })], new Set(["b"]));
    expect(stillThere.cars).toEqual([car("a", { priceRetail: 2 }), car("b")]);
    expect(stillThere.changed).toBe(1);
    expect(stillThere.notFound).toEqual([]);
    expect(stillThere.imagesEdited).toEqual([]);
  });

  it("ids that happen to be property names of every object are just unknown ids", () => {
    const out = applyVehicleChanges([car("a")], [change("constructor", { p: 1 }), change("__proto__", { p: 1 }), change("toString", { p: 1 }), change("hasOwnProperty")], noneDeleted);
    expect(out.changed).toBe(0);
    expect(out.notFound).toEqual(["constructor", "__proto__", "toString", "hasOwnProperty"]);
    expect(out.cars).toEqual([car("a")]);
  });

  it("...and a car really can have such an id", () => {
    const out = applyVehicleChanges([car("constructor"), car("__proto__")], [change("constructor", { priceRetail: 1 }), change("__proto__", { priceRetail: 2 })], noneDeleted);
    expect(out.changed).toBe(2);
    expect(out.cars.map(c => (c as any).priceRetail)).toEqual([1, 2]);
  });

  it("an entry for a car that only USED to be there stays gone: no whole record means nothing to bring back", () => {
    const afterDelete = applyVehicleChanges([car("a")], [change("b", { make: "Ford", model: "Focus", priceRetail: 1 })], noneDeleted);
    expect(afterDelete.cars.map(c => (c as any).id)).toEqual(["a"]);
  });
});

describe("applyVehicleChanges: never mutates what it is given", () => {
  it("deep-frozen cars, changes and deletedIds all go through: nothing is touched", () => {
    const cars = deepFreeze([car("a", { costs: [{ label: "x", amount: 1 }], mot: { expiry: "2026-01-01" } }), car("b", { notes: "n" })]);
    const changes = deepFreeze([change("a", { priceRetail: 1, costs: [] }, ["mot"]), change("b", undefined, ["notes"]), change("ghost", { p: 1 })]);
    const deleted = new Set(["zzz"]);
    const carsBefore = structuredClone(cars);
    const changesBefore = structuredClone(changes);

    const out = applyVehicleChanges(cars, changes, deleted);

    expect(cars).toEqual(carsBefore);
    expect(changes).toEqual(changesBefore);
    expect([...deleted]).toEqual(["zzz"]);
    expect(out.cars).not.toBe(cars);
    expect(out.cars[0]).not.toBe(cars[0]);
    expect(out.cars[1]).not.toBe(cars[1]);
  });

  it("the car an entry touches is a new object; every other car is passed through as the same object", () => {
    const a = car("a");
    const b = car("b");
    const junk = { note: "no id" };
    const out = applyVehicleChanges([a, null, junk, b], [change("a", { priceRetail: 1 })], noneDeleted);
    expect(out.cars[0]).not.toBe(a);
    expect(out.cars[1]).toBeNull();
    expect(out.cars[2]).toBe(junk);
    expect(out.cars[3]).toBe(b);
    expect(a.priceRetail).toBe(5000);
  });

  it("changing the result afterwards doesn't reach back into the cars that were given", () => {
    const before = [car("a")];
    const out = applyVehicleChanges(before, [change("a", { priceRetail: 1 })], noneDeleted);
    (out.cars[0] as any).make = "Tampered";
    (out.cars as unknown[]).push("extra");
    expect(before).toEqual([car("a")]);
  });
});

describe("applyVehicleChanges: __proto__ and friends are only ever plain field names", () => {
  it("a __proto__ field (as parsed from JSON) becomes an own data field, never the car's prototype", () => {
    const set = JSON.parse('{"__proto__":{"polluted":"yes"},"priceRetail":1}');
    const out = applyVehicleChanges([car("a")], [{ id: "a", set }], noneDeleted);
    const a = out.cars[0] as any;
    expect(Object.getPrototypeOf(a)).toBe(Object.prototype);
    expect(a.polluted).toBeUndefined();
    expect(Object.keys(a)).toContain("__proto__");
    expect(Object.getOwnPropertyDescriptor(a, "__proto__")?.value).toEqual({ polluted: "yes" });
    expect(({} as any).polluted).toBeUndefined();
    expect(a.priceRetail).toBe(1);
  });

  it("a stored car that already has such a field keeps it as a field when it is edited", () => {
    const stored = JSON.parse('{"id":"a","__proto__":{"kept":true},"priceRetail":5}');
    const out = applyVehicleChanges([stored], [change("a", { priceRetail: 6 })], noneDeleted);
    const a = out.cars[0] as any;
    expect(Object.getPrototypeOf(a)).toBe(Object.prototype);
    expect(a.kept).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(a, "__proto__")?.value).toEqual({ kept: true });
    expect(a.priceRetail).toBe(6);
  });
});

describe("applyVehicleChanges: imagesEdited", () => {
  it("names the cars an applied entry set or removed `images` on, once each", () => {
    const out = applyVehicleChanges(
      [car("a"), car("b"), car("c"), car("d")],
      [change("a", { images: ["x"] }), change("b", undefined, ["images"]), change("c", { priceRetail: 1 }), change("a", { images: [] }), change("d", { notes: "n" }, ["make"])],
      noneDeleted
    );
    expect(out.imagesEdited).toEqual(["a", "b"]);
  });

  it("does not name cars whose entry wasn't applied", () => {
    const out = applyVehicleChanges([car("a")], [change("ghost", { images: ["x"] }), change("gone", undefined, ["images"])], new Set(["gone"]));
    expect(out.imagesEdited).toEqual([]);
  });

  it("does not count a field that merely has 'images' inside its name or value", () => {
    const out = applyVehicleChanges([car("a")], [change("a", { imagesNote: "x", notes: "images" }, ["moreImages"])], noneDeleted);
    expect(out.imagesEdited).toEqual([]);
  });
});

describe("applyVehicleChanges: the stored list isn't always tidy", () => {
  it("passes entries that aren't cars straight through and never matches them", () => {
    const out = applyVehicleChanges([null, "text", 5, { note: "no id" }, { id: "", make: "x" }, car("a")], [change("", { p: 1 }), change("a", { p: 2 })], noneDeleted);
    expect(out.cars.slice(0, 5)).toEqual([null, "text", 5, { note: "no id" }, { id: "", make: "x" }]);
    expect(out.changed).toBe(1);
    expect(out.notFound).toEqual([""]);
  });

  it("if the same id is stored twice, both copies are changed and the entry counts once", () => {
    const out = applyVehicleChanges([car("a"), car("b"), car("a", { model: "Ka" })], [change("a", { priceRetail: 1 })], noneDeleted);
    expect(out.cars.map(c => (c as any).priceRetail)).toEqual([1, 5000, 1]);
    expect((out.cars[2] as any).model).toBe("Ka");
    expect(out.changed).toBe(1);
  });
});
