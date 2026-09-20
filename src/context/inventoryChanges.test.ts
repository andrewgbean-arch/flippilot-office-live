import { describe, it, expect } from "vitest";
import {
  applyEdit,
  carLabel,
  deletedByOthersNotice,
  diffVehicle,
  isEditableField,
  isEmptyEdit,
  mergeEdit,
  sameServerCar,
  sameValue,
  subtractSent,
  toWireChange,
  type FieldEdit,
} from "./inventoryChanges";
import type { Vehicle } from "../types/Vehicle";

// The pure rules behind "send only what the user changed". A mistake here is
// how one person's edit silently undoes another's, so each rule has its own
// test, and every function is checked not to touch what it was given.

const car = (extra: Record<string, unknown> = {}) =>
  ({ id: "a", make: "Ford", model: "Fiesta", priceRetail: 5000, mileage: 40000, images: null, ...extra }) as unknown as Vehicle;

const edit = (set: Record<string, unknown> = {}, unset: string[] = []): FieldEdit => ({ set, unset: new Set(unset) });
const plain = (e: FieldEdit | null) => (e === null ? null : { set: { ...e.set }, unset: [...e.unset].sort() });

// Freezes a value all the way down, so any attempt to change it throws (the
// test files are modules, so a write to a frozen object is an error).
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

describe("sameValue", () => {
  it("compares primitives strictly", () => {
    expect(sameValue(1, 1)).toBe(true);
    expect(sameValue("a", "a")).toBe(true);
    expect(sameValue(true, true)).toBe(true);
    expect(sameValue(null, null)).toBe(true);
    expect(sameValue(undefined, undefined)).toBe(true);
    expect(sameValue(1, 2)).toBe(false);
    expect(sameValue(1, "1")).toBe(false);
    expect(sameValue(0, false)).toBe(false);
    expect(sameValue("", null)).toBe(false);
    expect(sameValue(true, false)).toBe(false);
  });

  it("null is not undefined, and neither is an empty object or list", () => {
    expect(sameValue(null, undefined)).toBe(false);
    expect(sameValue(undefined, null)).toBe(false);
    expect(sameValue({}, null)).toBe(false);
    expect(sameValue(null, {})).toBe(false);
    expect(sameValue([], null)).toBe(false);
    expect(sameValue(undefined, {})).toBe(false);
    expect(sameValue([], {})).toBe(false);
    expect(sameValue({}, [])).toBe(false);
  });

  it("NaN equals NaN, and nothing else", () => {
    expect(sameValue(NaN, NaN)).toBe(true);
    expect(sameValue(NaN, 0)).toBe(false);
    expect(sameValue(0, NaN)).toBe(false);
    expect(sameValue(NaN, undefined)).toBe(false);
    expect(sameValue(NaN, "NaN")).toBe(false);
    expect(sameValue({ n: NaN }, { n: NaN })).toBe(true);
    expect(sameValue([NaN], [NaN])).toBe(true);
  });

  it("the very same object is the same without looking inside it (even one that refers to itself)", () => {
    const loop: Record<string, unknown> = { a: 1 };
    loop.self = loop;
    expect(sameValue(loop, loop)).toBe(true);
    const list: unknown[] = [];
    list.push(list);
    expect(sameValue(list, list)).toBe(true);
  });

  it("ignores key order, at any depth", () => {
    expect(sameValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameValue({ mot: { x: 1, y: { p: 1, q: 2 } } }, { mot: { y: { q: 2, p: 1 }, x: 1 } })).toBe(true);
    expect(sameValue([{ a: 1, b: 2 }], [{ b: 2, a: 1 }])).toBe(true);
  });

  it("ignores keys whose value is undefined: absent and undefined are the same thing", () => {
    expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameValue({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(sameValue({ a: 1, b: undefined }, { a: 1, c: undefined })).toBe(true);
    expect(sameValue({ a: undefined }, {})).toBe(true);
    expect(sameValue({ mot: { x: 1, y: undefined } }, { mot: { x: 1 } })).toBe(true);
    // ...but undefined is not null, and a defined value is not absence
    expect(sameValue({ a: undefined }, { a: null })).toBe(false);
    expect(sameValue({ a: null }, {})).toBe(false);
    expect(sameValue({ a: 0 }, {})).toBe(false);
    expect(sameValue({}, { a: "" })).toBe(false);
  });

  it("finds any difference in the values, however deep", () => {
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameValue({ a: 1 }, { b: 1 })).toBe(false);
    expect(sameValue({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    expect(sameValue({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameValue({ mot: { expiry: "2030-01-01" } }, { mot: { expiry: "2031-01-01" } })).toBe(false);
    expect(sameValue({ mot: { history: [{ result: "Pass" }] } }, { mot: { history: [{ result: "Fail" }] } })).toBe(false);
  });

  it("compares arrays element by element, in order", () => {
    expect(sameValue([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(sameValue([], [])).toBe(true);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
    expect(sameValue([1], [1, 2])).toBe(false);
    expect(sameValue([1, 2], [1])).toBe(false);
    expect(sameValue([{ a: 1 }], [{ a: 2 }])).toBe(false);
    expect(sameValue(["/p/1.jpg", "/p/2.jpg"], ["/p/2.jpg", "/p/1.jpg"])).toBe(false);
    expect(sameValue([undefined], [])).toBe(false); // a slot is not nothing
    expect(sameValue([undefined], [null])).toBe(false);
  });

  it("only ever calls plain data equal: two different dates are not the same", () => {
    expect(sameValue(new Date(1), new Date(2))).toBe(false);
    expect(sameValue(new Date(0), {})).toBe(false);
  });

  it("does not mistake an inherited property for a value", () => {
    expect(sameValue({}, { toString: undefined })).toBe(true);
    expect(sameValue({ toString: 1 }, { valueOf: 1 })).toBe(false);
    expect(sameValue(Object.create({ a: 1 }), { a: 1 })).toBe(false);
  });

  it("does not change what it compares", () => {
    const a = deepFreeze({ mot: { history: [{ result: "Pass", advisories: ["x"] }] }, images: ["/a.jpg"] });
    const b = deepFreeze({ images: ["/a.jpg"], mot: { history: [{ advisories: ["x"], result: "Pass" }] } });
    expect(sameValue(a, b)).toBe(true);
  });
});

describe("sameServerCar", () => {
  it("is sameValue for everything except how 'no pictures' is written", () => {
    expect(sameServerCar(car(), car())).toBe(true);
    expect(sameServerCar(car({ priceRetail: 1 }), car())).toBe(false);
    expect(sameServerCar(car({ images: ["/p/1.jpg"] }), car({ images: ["/p/2.jpg"] }))).toBe(false);
    expect(sameServerCar(car({ images: ["/p/1.jpg"] }), car({ images: null }))).toBe(false);
  });

  it("no pictures is the same whether it is null, an empty list or missing", () => {
    expect(sameServerCar(car({ images: null }), car({ images: [] }))).toBe(true);
    expect(sameServerCar(car({ images: [] }), car({ images: null }))).toBe(true);
    expect(sameServerCar(car({ images: [] }), car({ images: undefined }))).toBe(true);
    expect(sameServerCar(car({ images: null }), car({ images: undefined }))).toBe(true);
  });

  it("but a real difference elsewhere still counts when the pictures are written differently", () => {
    expect(sameServerCar(car({ images: null, priceRetail: 1 }), car({ images: [] }))).toBe(false);
  });

  it("copes with things that aren't cars", () => {
    expect(sameServerCar(undefined, car())).toBe(false);
    expect(sameServerCar(car(), undefined)).toBe(false);
    expect(sameServerCar(null, null)).toBe(true);
  });
});

describe("diffVehicle", () => {
  it("is null when nothing differs, for the same object and for an equal copy", () => {
    const a = car();
    expect(diffVehicle(a, a)).toBeNull();
    expect(diffVehicle(a, { ...a })).toBeNull();
    expect(diffVehicle(a, car())).toBeNull();
  });

  it("names only the field that changed", () => {
    expect(plain(diffVehicle(car(), car({ priceRetail: 6000 })))).toEqual({ set: { priceRetail: 6000 }, unset: [] });
  });

  it("names every field that changed, and nothing else", () => {
    const e = diffVehicle(car(), car({ priceRetail: 6000, mileage: 41000, notes: "Two keys" }));
    expect(plain(e)).toEqual({ set: { priceRetail: 6000, mileage: 41000, notes: "Two keys" }, unset: [] });
  });

  it("does not send a field just because it is written in a different order", () => {
    const before = { id: "a", make: "Ford", model: "Fiesta", mot: { expiry: "x", advisories: [] } } as unknown as Vehicle;
    const after = { mot: { advisories: [], expiry: "x" }, model: "Fiesta", make: "Ford", id: "a" } as unknown as Vehicle;
    expect(diffVehicle(before, after)).toBeNull();
  });

  it("treats undefined and absent as the same, in both directions", () => {
    expect(diffVehicle(car({ notes: undefined }), car())).toBeNull();
    expect(diffVehicle(car(), car({ notes: undefined }))).toBeNull();
    expect(diffVehicle(car({ notes: undefined }), car({ notes: undefined }))).toBeNull();
  });

  it("a field that stops having a value is unset, whether it is missing or explicitly undefined", () => {
    expect(plain(diffVehicle(car({ notes: "x" }), car()))).toEqual({ set: {}, unset: ["notes"] });
    expect(plain(diffVehicle(car({ notes: "x" }), car({ notes: undefined })))).toEqual({ set: {}, unset: ["notes"] });
  });

  it("a field set to null is a value (set), not a removal", () => {
    expect(plain(diffVehicle(car({ notes: "x" }), car({ notes: null })))).toEqual({ set: { notes: null }, unset: [] });
    expect(plain(diffVehicle(car(), car({ notes: null })))).toEqual({ set: { notes: null }, unset: [] });
  });

  it("a field that didn't exist and now does is set", () => {
    expect(plain(diffVehicle(car(), car({ colour: "Red" })))).toEqual({ set: { colour: "Red" }, unset: [] });
  });

  it("a field can be both changed and another removed in one edit", () => {
    expect(plain(diffVehicle(car({ notes: "x" }), car({ notes: undefined, priceRetail: 1 })))).toEqual({
      set: { priceRetail: 1 },
      unset: ["notes"],
    });
  });

  it("never includes id, whatever happened to it", () => {
    expect(diffVehicle(car({ id: "a" }), car({ id: "b" }))).toBeNull();
    expect(plain(diffVehicle(car({ id: "a" }), car({ id: "b", priceRetail: 1 })))).toEqual({ set: { priceRetail: 1 }, unset: [] });
    const gone = { make: "Ford", model: "Fiesta", priceRetail: 5000, mileage: 40000, images: null } as unknown as Vehicle;
    expect(diffVehicle(car(), gone)).toBeNull(); // an id that vanished is not an unset of id
  });

  it("never includes the names the server refuses, so one odd field can't block every save", () => {
    const odd = JSON.parse('{"__proto__": {"x": 1}, "constructor": "c", "prototype": "p"}') as Record<string, unknown>;
    const e = diffVehicle(car(), { ...car(), ...odd, priceRetail: 1 } as unknown as Vehicle);
    expect(plain(e)).toEqual({ set: { priceRetail: 1 }, unset: [] });
    expect(diffVehicle({ ...car(), ...odd } as unknown as Vehicle, car())).toBeNull();
  });

  it("a changed nested value is a changed field, sent whole", () => {
    const before = car({ mot: { expiry: "2030-01-01", advisories: [], historyScore: 1, history: [] } });
    const after = car({ mot: { expiry: "2031-01-01", advisories: [], historyScore: 1, history: [] } });
    const e = diffVehicle(before, after)!;
    expect(Object.keys(e.set)).toEqual(["mot"]);
    expect(e.set.mot).toBe((after as unknown as { mot: unknown }).mot); // the whole new value, not a copy of a piece
  });

  it("a nested value that is only written differently is not a change", () => {
    const before = car({ mot: { expiry: "x", history: [{ result: "Pass", advisories: [] }], extra: undefined } });
    const after = car({ mot: { history: [{ advisories: [], result: "Pass" }], expiry: "x" } });
    expect(diffVehicle(before, after)).toBeNull();
  });

  it("lists are changed by order or content, null and empty are different values", () => {
    expect(plain(diffVehicle(car({ images: ["a", "b"] }), car({ images: ["b", "a"] })))).toEqual({ set: { images: ["b", "a"] }, unset: [] });
    expect(diffVehicle(car({ images: ["a", "b"] }), car({ images: ["a", "b"] }))).toBeNull();
    expect(plain(diffVehicle(car({ images: null }), car({ images: [] })))).toEqual({ set: { images: [] }, unset: [] });
    expect(plain(diffVehicle(car({ images: ["a"] }), car({ images: null })))).toEqual({ set: { images: null }, unset: [] });
  });

  it("NaN staying NaN is not a change; becoming NaN is", () => {
    expect(diffVehicle(car({ mileage: NaN }), car({ mileage: NaN }))).toBeNull();
    expect(plain(diffVehicle(car({ mileage: 1 }), car({ mileage: NaN })))).toEqual({ set: { mileage: NaN }, unset: [] });
  });

  it("does not take a field the car merely inherits for one of its own", () => {
    const e = diffVehicle(car(), car({ toString: "x" }));
    expect(plain(e)).toEqual({ set: { toString: "x" }, unset: [] });
  });

  it("changes neither car", () => {
    const before = deepFreeze(car({ notes: "x", mot: { expiry: "a", history: [] }, images: ["a"] }));
    const after = deepFreeze(car({ notes: undefined, mot: { expiry: "b", history: [] }, images: ["a"], priceRetail: 1 }));
    expect(() => diffVehicle(before, after)).not.toThrow();
  });
});

describe("applyEdit", () => {
  it("sets the fields, removes the unset ones and leaves the rest", () => {
    const next = applyEdit(car({ notes: "x", colour: "Red" }), edit({ priceRetail: 1, mileage: 2 }, ["notes"]));
    expect(next).toEqual(car({ priceRetail: 1, mileage: 2, colour: "Red" }));
    expect("notes" in next).toBe(false);
  });

  it("returns a new car and changes neither the car nor the edit", () => {
    const before = deepFreeze(car({ notes: "x" }));
    const e = { set: deepFreeze({ priceRetail: 1 }), unset: new Set(["notes"]) };
    const next = applyEdit(before, e);
    expect(next).not.toBe(before);
    expect(before).toEqual(car({ notes: "x" }));
    expect(e.unset.has("notes")).toBe(true);
  });

  it("puts the edit's own values in, not copies", () => {
    const mot = { expiry: "x", advisories: [], historyScore: 0, history: [] };
    expect((applyEdit(car(), edit({ mot })) as unknown as { mot: unknown }).mot).toBe(mot);
  });

  it("an empty edit gives an equal car", () => {
    expect(applyEdit(car(), edit())).toEqual(car());
  });

  it("the id is always kept, and the names the server refuses can't be set or removed", () => {
    const evil = JSON.parse('{"id": "other", "__proto__": {"polluted": true}, "constructor": "c", "prototype": "p", "priceRetail": 1}') as Record<string, unknown>;
    const next = applyEdit(car(), edit(evil, ["id", "make"]));
    expect(next.id).toBe("a");
    expect(next.priceRetail).toBe(1);
    expect("make" in next).toBe(false); // an ordinary field can still be removed
    expect((next as unknown as { polluted?: boolean }).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(next, "constructor")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(next, "prototype")).toBe(false);
  });
});

describe("mergeEdit", () => {
  it("with nothing waiting, is just the newer edit (as a copy)", () => {
    const newer = edit({ priceRetail: 1 }, ["notes"]);
    const merged = mergeEdit(undefined, newer);
    expect(plain(merged)).toEqual({ set: { priceRetail: 1 }, unset: ["notes"] });
    expect(merged.set).not.toBe(newer.set);
    expect(merged.unset).not.toBe(newer.unset);
  });

  it("edits of different fields both stay", () => {
    expect(plain(mergeEdit(edit({ priceRetail: 1 }, ["notes"]), edit({ mileage: 2 }, ["colour"])))).toEqual({
      set: { priceRetail: 1, mileage: 2 },
      unset: ["colour", "notes"],
    });
  });

  it("the same field twice keeps the later value", () => {
    expect(plain(mergeEdit(edit({ priceRetail: 1 }), edit({ priceRetail: 2 })))).toEqual({ set: { priceRetail: 2 }, unset: [] });
  });

  it("removing a field twice is one removal", () => {
    expect(plain(mergeEdit(edit({}, ["notes"]), edit({}, ["notes"])))).toEqual({ set: {}, unset: ["notes"] });
  });

  it("a later set of a field takes it out of the removals", () => {
    expect(plain(mergeEdit(edit({}, ["notes"]), edit({ notes: "back" })))).toEqual({ set: { notes: "back" }, unset: [] });
  });

  it("a later removal of a field takes it out of the sets", () => {
    expect(plain(mergeEdit(edit({ notes: "x", priceRetail: 1 }), edit({}, ["notes"])))).toEqual({ set: { priceRetail: 1 }, unset: ["notes"] });
  });

  it("changes neither input", () => {
    const pending = edit({ priceRetail: 1 }, ["notes"]);
    const newer = edit({ notes: "back", mileage: 2 }, ["priceRetail"]);
    const merged = mergeEdit(pending, newer);
    expect(plain(pending)).toEqual({ set: { priceRetail: 1 }, unset: ["notes"] });
    expect(plain(newer)).toEqual({ set: { notes: "back", mileage: 2 }, unset: ["priceRetail"] });
    expect(merged.set).not.toBe(pending.set);
  });
});

describe("subtractSent", () => {
  it("what was sent and is still waiting with the same value is done; null when nothing is left", () => {
    expect(subtractSent(edit({ priceRetail: 1 }, ["notes"]), edit({ priceRetail: 1 }, ["notes"]))).toBeNull();
  });

  it("a field changed again while the request was away keeps its newer value", () => {
    const rest = subtractSent(edit({ priceRetail: 2, mileage: 5 }), edit({ priceRetail: 1, mileage: 5 }));
    expect(plain(rest)).toEqual({ set: { priceRetail: 2 }, unset: [] });
  });

  it("a value that is only written differently counts as the same value", () => {
    const sentMot = { expiry: "x", history: [] };
    const nowMot = { history: [], expiry: "x" };
    expect(subtractSent(edit({ mot: nowMot }), edit({ mot: sentMot }))).toBeNull();
  });

  it("a field sent as a value but removed since stays removed", () => {
    const rest = subtractSent(edit({}, ["notes"]), edit({ notes: "x" }));
    expect(plain(rest)).toEqual({ set: {}, unset: ["notes"] });
  });

  it("a field sent as removed but given a value since keeps that value", () => {
    const rest = subtractSent(edit({ notes: "new" }), edit({}, ["notes"]));
    expect(plain(rest)).toEqual({ set: { notes: "new" }, unset: [] });
  });

  it("a removal that was sent and is still waiting is done", () => {
    const rest = subtractSent(edit({ priceRetail: 3 }, ["notes"]), edit({}, ["notes"]));
    expect(plain(rest)).toEqual({ set: { priceRetail: 3 }, unset: [] });
  });

  it("fields that were waiting but not sent stay", () => {
    const rest = subtractSent(edit({ priceRetail: 1, mileage: 2 }, ["notes", "colour"]), edit({ priceRetail: 1 }, ["notes"]));
    expect(plain(rest)).toEqual({ set: { mileage: 2 }, unset: ["colour"] });
  });

  it("sent fields that are no longer waiting at all change nothing", () => {
    expect(plain(subtractSent(edit({ mileage: 2 }), edit({ priceRetail: 1 }, ["notes"])))).toEqual({ set: { mileage: 2 }, unset: [] });
  });

  it("never returns an empty edit", () => {
    const rest = subtractSent(edit({ a: 1, b: 2 }, ["c"]), edit({ a: 1 }, ["c"]));
    expect(rest).not.toBeNull();
    expect(isEmptyEdit(rest!)).toBe(false);
  });

  it("changes neither input", () => {
    const pending = edit({ priceRetail: 1, mileage: 2 }, ["notes"]);
    const sent = edit({ priceRetail: 1 }, ["notes"]);
    subtractSent(pending, sent);
    expect(plain(pending)).toEqual({ set: { priceRetail: 1, mileage: 2 }, unset: ["notes"] });
    expect(plain(sent)).toEqual({ set: { priceRetail: 1 }, unset: ["notes"] });
  });
});

describe("toWireChange", () => {
  it("names the car and both halves", () => {
    expect(toWireChange("a", edit({ priceRetail: 1 }, ["notes"]))).toEqual({ id: "a", set: { priceRetail: 1 }, unset: ["notes"] });
  });

  it("leaves out an empty half", () => {
    expect(toWireChange("a", edit({ priceRetail: 1 }))).toEqual({ id: "a", set: { priceRetail: 1 } });
    expect("unset" in toWireChange("a", edit({ priceRetail: 1 }))).toBe(false);
    expect(toWireChange("a", edit({}, ["notes"]))).toEqual({ id: "a", unset: ["notes"] });
    expect("set" in toWireChange("a", edit({}, ["notes"]))).toBe(false);
  });

  it("is a copy: changing it later doesn't change the edit that was waiting", () => {
    const e = edit({ priceRetail: 1 }, ["notes"]);
    const wire = toWireChange("a", e);
    wire.set!.priceRetail = 99;
    wire.unset!.push("x");
    expect(plain(e)).toEqual({ set: { priceRetail: 1 }, unset: ["notes"] });
  });
});

describe("isEditableField", () => {
  it("is false for the id and the names that reach an object's prototype", () => {
    for (const name of ["id", "__proto__", "constructor", "prototype"]) expect(isEditableField(name), name).toBe(false);
    for (const name of ["priceRetail", "mot", "images", "Id", "ID", "proto"]) expect(isEditableField(name), name).toBe(true);
  });
});

describe("naming a car in a message", () => {
  it("make, model and registration", () => {
    expect(carLabel(car({ reg: "AB12 CDE" }))).toBe("Ford Fiesta (AB12 CDE)");
  });

  it("without a registration, or without a make and model", () => {
    expect(carLabel(car())).toBe("Ford Fiesta");
    expect(carLabel(car({ make: "", model: "", reg: "AB12 CDE" }))).toBe("AB12 CDE");
    expect(carLabel(car({ make: "Ford", model: "  ", reg: "" }))).toBe("Ford");
  });

  it("null when there's nothing to call it by", () => {
    expect(carLabel(undefined)).toBeNull();
    expect(carLabel({ id: "x" } as unknown as Vehicle)).toBeNull();
    expect(carLabel(car({ make: null, model: undefined, reg: 5 }) as Vehicle)).toBe("5");
  });
});

describe("the notice about cars deleted by someone else", () => {
  it("one named car, in the words the dealer will read", () => {
    expect(deletedByOthersNotice(["Ford Fiesta (AB12 CDE)"])).toBe(
      `"Ford Fiesta (AB12 CDE)" was deleted by someone else, so your change to it wasn't saved.`
    );
  });

  it("one car we can't name", () => {
    expect(deletedByOthersNotice([null])).toBe("A car was deleted by someone else, so your change to it wasn't saved.");
  });

  it("several cars: one notice that lists them all", () => {
    const text = deletedByOthersNotice(["Ford Fiesta (AB12 CDE)", "BMW 1 Series"]);
    expect(text).toBe(
      `Some cars were deleted by someone else, so your changes to them weren't saved: "Ford Fiesta (AB12 CDE)" and "BMW 1 Series".`
    );
    expect(deletedByOthersNotice(["A", "B", "C"])).toContain(`"A", "B" and "C"`);
  });

  it("says how many it couldn't name", () => {
    expect(deletedByOthersNotice(["A", null])).toContain(`"A" and another car`);
    expect(deletedByOthersNotice(["A", null, null])).toContain(`"A" and 2 other cars`);
    expect(deletedByOthersNotice([null, null])).toContain("2 other cars");
  });

  it("never blames a person and has nothing to say about no cars", () => {
    expect(deletedByOthersNotice(["A"])).toMatch(/someone else/);
    expect(deletedByOthersNotice([])).toBe("");
  });
});
