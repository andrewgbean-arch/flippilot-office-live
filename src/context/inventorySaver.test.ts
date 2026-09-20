import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createInventorySaver,
  sameStatus,
  type InventorySaverOptions,
  type SaveResult,
  type SaverStatus,
} from "./inventorySaver";
import type { SavePayload } from "./inventoryChanges";
import type { Vehicle } from "../types/Vehicle";

// The client's half of "a stale or partial screen must never damage stock":
// it sends only what the user changed (new cars whole, field-level edits of
// existing ones, explicit deletions), forgets each piece only once the server
// confirms it, keeps everything when a save fails, and takes in the server's
// answer without laying it over what the user did meanwhile — and without ever
// mistaking "this screen hasn't seen someone else's edit" for "the user undid it".

const car = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, make: "Ford", model: "Fiesta", images: null, priceRetail: 5000, mileage: 40000, ...extra }) as unknown as Vehicle;
const ids = (list: readonly Vehicle[]) => list.map(v => v.id);
const byId = (list: readonly Vehicle[], id: string) => list.find(v => v.id === id);

interface Call {
  payload: SavePayload;
  respond: (result: SaveResult) => Promise<void>;
}

// A saver wired to a fake server we answer by hand, so the moment each
// answer lands (before or after more edits) is under the test's control.
function harness(extra: Partial<InventorySaverOptions> = {}) {
  const calls: Call[] = [];
  const shown: Vehicle[][] = [];
  const statuses: SaverStatus[] = [];
  const saver = createInventorySaver({
    send: payload =>
      new Promise<SaveResult>(resolve => {
        calls.push({
          payload,
          respond: async result => {
            resolve(result);
            // let the saver run everything that follows the answer
            await new Promise(r => setTimeout(r, 0));
          },
        });
      }),
    onVehicles: list => shown.push(list),
    onStatus: status => statuses.push(status),
    ...extra,
  });
  return {
    saver,
    calls,
    shown,
    statuses,
    screen: () => saver.getList(),
    lastStatus: () => statuses[statuses.length - 1]!,
  };
}
type Harness = ReturnType<typeof harness>;

// What the provider's mutators do: hand the saver a whole new list built from
// the one on screen.
const edit = (h: Harness, id: string, patch: Record<string, unknown>) =>
  h.saver.change(h.screen().map(v => (v.id === id ? ({ ...v, ...patch } as Vehicle) : v)));
const remove = (h: Harness, id: string) =>
  h.saver.change(
    h.screen().filter(v => v.id !== id),
    id
  );
const add = (h: Harness, ...cars: Vehicle[]) => h.saver.change([...h.screen(), ...cars]);

const ok = (items: Vehicle[]): SaveResult => ({ ok: true, items });
const okNotFound = (items: Vehicle[], notFound: string[]): SaveResult => ({ ok: true, items, notFound });
const failed = (message = "no luck", status: number | null = 500): SaveResult => ({ ok: false, status, message });
const settle = () => new Promise(r => setTimeout(r, 0));
const NOTHING: SavePayload = { items: [], changes: [], deletedIds: [] };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("what is sent", () => {
  it("nothing is saved until this login's stock has loaded, though the change still shows", async () => {
    const h = harness();
    await h.saver.change([car("a")]);
    expect(h.calls).toHaveLength(0);
    expect(ids(h.screen())).toEqual(["a"]);
    expect(h.saver.hasUnsaved()).toBe(false);
  });

  it("a retry before the stock has loaded sends nothing either", async () => {
    const h = harness();
    await h.saver.retry();
    expect(h.calls).toHaveLength(0);
  });

  it("a deletion or edit made before the stock loaded is not sent once it has", async () => {
    const h = harness();
    await h.saver.change([], "ghost"); // not this login's real stock yet
    await h.saver.change([car("g", { priceRetail: 1 })]);
    h.saver.loaded([car("a")]);

    void edit(h, "a", { priceRetail: 1 });
    expect(h.calls[0]!.payload).toEqual({ items: [], changes: [{ id: "a", set: { priceRetail: 1 } }], deletedIds: [] });
  });

  it("editing one field of one car sends exactly that field for that car, and nothing for any other car", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b", { make: "BMW" }), car("c", { make: "Audi" })]);
    void edit(h, "a", { priceRetail: 6000 });

    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.payload).toEqual({ items: [], changes: [{ id: "a", set: { priceRetail: 6000 } }], deletedIds: [] });
    const wire = JSON.stringify(h.calls[0]!.payload);
    expect(wire).not.toContain("BMW");
    expect(wire).not.toContain("Audi");
    expect(wire).not.toContain("Fiesta"); // not even the rest of car a
  });

  it("two edits of different fields merge into one entry for the car", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(failed());
    void edit(h, "a", { mileage: 2 });

    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "a", set: { priceRetail: 1, mileage: 2 } }]);
  });

  it("the same field edited twice sends the later value, once", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(failed());
    void edit(h, "a", { priceRetail: 2 });

    expect(h.calls[1]!.payload.changes).toEqual([{ id: "a", set: { priceRetail: 2 } }]);
  });

  it("a field that becomes undefined is sent as an unset, not a set", async () => {
    const h = harness();
    h.saver.loaded([car("a", { notes: "Two keys" })]);
    void edit(h, "a", { notes: undefined });

    const [change] = h.calls[0]!.payload.changes;
    expect(change).toEqual({ id: "a", unset: ["notes"] });
    expect("set" in change!).toBe(false);
  });

  it("removing a field and then giving it a value again sends the value, not the removal", async () => {
    const h = harness();
    h.saver.loaded([car("a", { notes: "x" })]);
    void edit(h, "a", { notes: undefined });
    await h.calls[0]!.respond(failed());
    void edit(h, "a", { notes: "y" });
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "a", set: { notes: "y" } }]);
  });

  it("giving a field a value and then removing it sends the removal, not the value", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { notes: "y" });
    await h.calls[0]!.respond(failed());
    void edit(h, "a", { notes: undefined });
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "a", unset: ["notes"] }]);
  });

  it("edits of two cars go in one request, one entry each", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(failed());
    void edit(h, "b", { mileage: 2 });
    expect(h.calls[1]!.payload.changes).toEqual([
      { id: "a", set: { priceRetail: 1 } },
      { id: "b", set: { mileage: 2 } },
    ]);
  });

  it("a whole nested field is sent whole", async () => {
    const h = harness();
    const mot = { expiry: "2030-01-01", advisories: [], historyScore: 1, history: [] };
    h.saver.loaded([car("a", { mot })]);
    void edit(h, "a", { mot: { ...mot, expiry: "2031-01-01" } });
    expect(h.calls[0]!.payload.changes).toEqual([{ id: "a", set: { mot: { ...mot, expiry: "2031-01-01" } } }]);
  });

  describe("an edit that changes nothing", () => {
    it("sends nothing, and doesn't count as an unsaved change", async () => {
      const h = harness();
      h.saver.loaded([car("a", { priceRetail: 5000 })]);
      const version = h.saver.stamp().version;
      const updates = h.statuses.length;

      await edit(h, "a", { priceRetail: 5000 }); // the same value, in a new object
      await edit(h, "a", { notes: undefined }); // undefined is absent
      const shownBefore = h.shown.length;
      await h.saver.change(h.screen()); // the very same list
      await h.saver.change([...h.screen()]); // the same cars in a new list
      expect(h.shown).toHaveLength(shownBefore); // the screen isn't told about a list that is the same one

      expect(h.calls).toHaveLength(0);
      expect(h.saver.hasUnsaved()).toBe(false);
      expect(h.saver.stamp().version).toBe(version); // an edit that didn't happen doesn't count as one
      expect(h.statuses).toHaveLength(updates); // nothing to report
    });

    it("to a car still waiting to be created sends nothing either", async () => {
      const h = harness();
      h.saver.loaded([car("a")]);
      void add(h, car("n", { priceRetail: 1 }));
      await h.calls[0]!.respond(failed());
      const version = h.saver.stamp().version;

      await edit(h, "n", { priceRetail: 1 }); // the same value again
      expect(h.calls).toHaveLength(1);
      expect(h.saver.stamp().version).toBe(version);
    });

    it("doesn't cause a follow-up request when a save is already on its way", async () => {
      const h = harness();
      h.saver.loaded([car("a")]);
      void edit(h, "a", { priceRetail: 1 });
      await edit(h, "a", { priceRetail: 1 }); // changes nothing
      await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 })]));
      expect(h.calls).toHaveLength(1);
    });

    it("leaves a refresh that began before it free to be adopted", () => {
      const h = harness();
      h.saver.loaded([car("a")]);
      const stamp = h.saver.stamp();
      void edit(h, "a", { priceRetail: 5000 }); // no change
      expect(h.saver.adoptRefresh(stamp, [car("a"), car("b")])).toBe(true);
      expect(ids(h.screen())).toEqual(["a", "b"]);
    });
  });
});

describe("cars created on this screen", () => {
  it("a new car is sent whole, in items, and is not also an edit", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    const fresh = car("n", { make: "Audi", priceRetail: 9000 });
    void add(h, fresh);

    expect(h.calls[0]!.payload.items).toEqual([fresh]);
    expect(h.calls[0]!.payload.changes).toEqual([]);
    expect(h.calls[0]!.payload.deletedIds).toEqual([]);
    expect(ids(h.screen())).toEqual(["a", "n"]);
  });

  it("several created at once (an import) go together, in order", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void add(h, car("n1"), car("n2"), car("n3"));
    expect(ids(h.calls[0]!.payload.items)).toEqual(["n1", "n2", "n3"]);
  });

  it("edited before the server has confirmed it, the record is replaced: one entry, the latest data", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void add(h, car("n", { priceRetail: 1 }));
    await h.calls[0]!.respond(failed());

    void edit(h, "n", { priceRetail: 7, notes: "Two keys" });
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.payload.items).toHaveLength(1);
    expect(h.calls[1]!.payload.items[0]).toMatchObject({ id: "n", priceRetail: 7, notes: "Two keys" });
    expect(h.calls[1]!.payload.changes).toEqual([]); // not a field edit: the server has nothing to apply one to
  });

  it("a new car whose save failed is sent again, whole", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void add(h, car("n"));
    await h.calls[0]!.respond(failed());
    void h.saver.retry();
    expect(h.calls[1]!.payload).toEqual(h.calls[0]!.payload);
    expect(h.calls[1]!.payload.items).toHaveLength(1);
  });

  it("once the server has confirmed it, it is not sent again", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void add(h, car("n"));
    await h.calls[0]!.respond(ok([car("a"), car("n")]));
    void edit(h, "a", { priceRetail: 1 });
    expect(h.calls[1]!.payload.items).toEqual([]);
    expect(ids(h.screen())).toEqual(["a", "n"]);
  });

  it("edited while its first save is in flight: a follow-up carries only the difference, as a field edit", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void add(h, car("n", { priceRetail: 1, mileage: 10 }));
    void edit(h, "n", { priceRetail: 9 }); // while the first save is on its way
    expect(h.calls).toHaveLength(1);

    await h.calls[0]!.respond(ok([car("a"), car("n", { priceRetail: 1, mileage: 10 })]));
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.payload).toEqual({ items: [], changes: [{ id: "n", set: { priceRetail: 9 } }], deletedIds: [] });
    expect(byId(h.screen(), "n")).toMatchObject({ priceRetail: 9, mileage: 10 }); // the edit is on screen throughout

    await h.calls[1]!.respond(ok([car("a"), car("n", { priceRetail: 9, mileage: 10 })]));
    expect(h.calls).toHaveLength(2);
    expect(h.saver.hasUnsaved()).toBe(false);
  });

  it("deleted while its first save is in flight: the delete goes in the next request and it never comes back", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void add(h, car("n"));
    void remove(h, "n");
    expect(ids(h.screen())).toEqual(["a"]);

    // the server created it (that request was already on its way)
    await h.calls[0]!.respond(ok([car("a"), car("n")]));
    expect(ids(h.screen())).toEqual(["a"]); // not resurrected by that answer
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.payload).toEqual({ items: [], changes: [], deletedIds: ["n"] });

    await h.calls[1]!.respond(ok([car("a")]));
    expect(ids(h.screen())).toEqual(["a"]);
    expect(h.saver.hasUnsaved()).toBe(false);
    expect(h.calls).toHaveLength(2);
  });

  it("created and deleted before any save got through: only the deletion is sent", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void add(h, car("n"));
    await h.calls[0]!.respond(failed());
    void remove(h, "n");
    expect(h.calls[1]!.payload).toEqual({ items: [], changes: [], deletedIds: ["n"] });
  });
});

describe("deleting", () => {
  it("a deleted car's id is sent, and stops being sent once the server confirms it", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);

    void remove(h, "a");
    expect(h.calls[0]!.payload).toEqual({ items: [], changes: [], deletedIds: ["a"] });
    expect(ids(h.screen())).toEqual(["b"]);
    // still on its way: not yet forgotten
    expect(h.saver.hasUnsaved()).toBe(true);

    await h.calls[0]!.respond(ok([car("b")]));
    expect(h.saver.hasUnsaved()).toBe(false);

    void edit(h, "b", { priceRetail: 9 });
    expect(h.calls[1]!.payload.deletedIds).toEqual([]);
  });

  it("deletions made during a save's flight are not forgotten when that save is confirmed", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b"), car("c")]);

    void remove(h, "a"); // in flight, carrying [a]
    void remove(h, "b"); // deleted while that was on its way
    expect(h.calls).toHaveLength(1);

    await h.calls[0]!.respond(ok([car("b"), car("c")])); // confirms only a
    // the follow-up now carries b, and only b
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.payload).toEqual({ items: [], changes: [], deletedIds: ["b"] });
    expect(ids(h.screen())).toEqual(["c"]);
  });

  it("a car with edits waiting is deleted: its edits are never sent", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(failed());

    void remove(h, "a");
    expect(h.calls[1]!.payload).toEqual({ items: [], changes: [], deletedIds: ["a"] });
  });

  it("a deletion stays pending until confirmed, and is sent again after a failure", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void remove(h, "a");
    await h.calls[0]!.respond(failed());
    expect(h.saver.hasUnsaved()).toBe(true);

    void h.saver.retry();
    expect(h.calls[1]!.payload.deletedIds).toEqual(["a"]);
    await h.calls[1]!.respond(failed());

    void h.saver.retry();
    expect(h.calls[2]!.payload.deletedIds).toEqual(["a"]);
    await h.calls[2]!.respond(ok([car("b")]));
    expect(h.saver.hasUnsaved()).toBe(false);

    void h.saver.retry();
    expect(h.calls[3]!.payload.deletedIds).toEqual([]);
  });

  it("a car merely missing from a list is not a deletion: nothing is sent, and the server's list brings it back", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    await h.saver.change([byId(h.screen(), "b")!]); // a is left out, and nobody says it was deleted
    expect(h.calls).toHaveLength(0);
    expect(h.saver.hasUnsaved()).toBe(false);
    expect(ids(h.screen())).toEqual(["b"]);

    void h.saver.retry();
    expect(h.calls[0]!.payload.deletedIds).toEqual([]);
    await h.calls[0]!.respond(ok([car("a"), car("b")]));
    expect(ids(h.screen())).toEqual(["a", "b"]);
  });

  it("naming a car as deleted while it is still in the list is not a deletion", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    await h.saver.change(h.screen(), "a");
    expect(h.calls).toHaveLength(0);
    expect(h.saver.hasUnsaved()).toBe(false);
  });

  it("deleting an id that isn't on screen is still sent, since the caller said so", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void h.saver.change(h.screen(), "elsewhere");
    expect(h.calls[0]!.payload.deletedIds).toEqual(["elsewhere"]);
  });
});

describe("when a save fails", () => {
  it("keeps the list, the deletion and the reason, and does not retry by itself", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void h.saver.change([{ ...byId(h.screen(), "b")!, priceRetail: 7 }], "a");

    await h.calls[0]!.respond(failed("Your stock is too big to save", 413));
    await settle();

    expect(h.calls).toHaveLength(1); // no retry loop
    expect(h.lastStatus()).toEqual({ saving: false, error: "Your stock is too big to save", unsaved: true, notice: null });
    expect(h.saver.hasUnsaved()).toBe(true);
    expect(ids(h.screen())).toEqual(["b"]);
    expect(h.screen()[0]).toMatchObject({ priceRetail: 7 }); // the edit is still on screen
  });

  it("the next attempt sends the same payload again, and success clears it", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b", { notes: "old note" }), car("c")]);
    void h.saver.change([{ ...byId(h.screen(), "b")!, priceRetail: 7, notes: undefined } as unknown as Vehicle, car("n")], "a");
    // (c is simply absent from that list: not a deletion)
    await h.calls[0]!.respond(failed());

    void h.saver.retry();
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.payload).toEqual(h.calls[0]!.payload);
    expect(h.calls[1]!.payload).toEqual({
      items: [car("n")],
      changes: [{ id: "b", set: { priceRetail: 7 }, unset: ["notes"] }],
      deletedIds: ["a"],
    });

    await h.calls[1]!.respond(ok([car("b", { priceRetail: 7 }), car("c"), car("n")]));
    expect(h.lastStatus()).toEqual({ saving: false, error: null, unsaved: false, notice: null });
    expect(h.saver.hasUnsaved()).toBe(false);
  });

  it("success clears what was sent: the next save carries only what is new", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("b")]));

    void edit(h, "b", { mileage: 2 });
    expect(h.calls[1]!.payload).toEqual({ items: [], changes: [{ id: "b", set: { mileage: 2 } }], deletedIds: [] });
  });

  it("the next edit tries again too, not only the retry button, and carries the earlier edit with it", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(failed());

    void edit(h, "a", { mileage: 2 });
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "a", set: { priceRetail: 1, mileage: 2 } }]);
  });

  it("treats a send that throws as a failed save, and keeps everything", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness({ send: () => Promise.reject(new Error("boom")) });
    h.saver.loaded([car("a")]);
    await edit(h, "a", { priceRetail: 1 });
    expect(h.lastStatus().error).toContain("couldn't save");
    expect(h.lastStatus().unsaved).toBe(true);
    expect(h.screen()[0]).toMatchObject({ priceRetail: 1 });
  });

  it("reports that a save is on its way, and that it isn't once done", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 });
    expect(h.lastStatus()).toMatchObject({ saving: true, unsaved: true });
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 })]));
    expect(h.lastStatus()).toEqual({ saving: false, error: null, unsaved: false, notice: null });
  });
});

describe("edits made while a save is on its way", () => {
  it("sends one save at a time: edits made during a flight go out together in one follow-up", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);

    void edit(h, "a", { priceRetail: 1 });
    void edit(h, "a", { priceRetail: 2 });
    void edit(h, "a", { priceRetail: 3 });
    void h.saver.retry();
    expect(h.calls).toHaveLength(1); // nothing overtakes the save in flight

    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 })]));
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "a", set: { priceRetail: 3 } }]);

    await h.calls[1]!.respond(ok([car("a", { priceRetail: 3 })]));
    expect(h.calls).toHaveLength(2); // and that's the last one
    expect(h.saver.hasUnsaved()).toBe(false);
  });

  it("two edits during one save produce exactly one follow-up", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    void edit(h, "b", { priceRetail: 2 });
    void edit(h, "b", { mileage: 3 });
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("b")]));
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "b", set: { priceRetail: 2, mileage: 3 } }]);
    await h.calls[1]!.respond(ok([car("a", { priceRetail: 1 }), car("b", { priceRetail: 2, mileage: 3 })]));
    expect(h.calls).toHaveLength(2);
  });

  it("a field edited again in flight stays waiting with its newer value; the ones that weren't are done", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1, mileage: 5 });
    void edit(h, "a", { priceRetail: 2 });

    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1, mileage: 5 })]));
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "a", set: { priceRetail: 2 } }]); // mileage isn't sent again
    expect(byId(h.screen(), "a")).toMatchObject({ priceRetail: 2, mileage: 5 });

    // The first save is confirmed, but the edit made meanwhile is not: still unsaved.
    expect(h.saver.hasUnsaved()).toBe(true);
    expect(h.lastStatus()).toMatchObject({ saving: true, unsaved: true });

    await h.calls[1]!.respond(ok([car("a", { priceRetail: 2, mileage: 5 })]));
    expect(h.saver.hasUnsaved()).toBe(false);
    expect(h.lastStatus()).toEqual({ saving: false, error: null, unsaved: false, notice: null });
  });

  it("a removal made in flight isn't lost when the earlier value is confirmed", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { notes: "x" });
    void edit(h, "a", { notes: undefined });
    await h.calls[0]!.respond(ok([car("a", { notes: "x" })]));
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "a", unset: ["notes"] }]);
    expect(h.screen()[0]).not.toHaveProperty("notes", "x");
  });

  it("does not lay the answer over an edit made while the save was in flight", async () => {
    const h = harness();
    h.saver.loaded([car("a", { priceRetail: 100 }), car("b")]);

    void edit(h, "a", { priceRetail: 200 }); // save 1 in flight
    void edit(h, "a", { priceRetail: 300 }); // edited again meanwhile

    // Save 1's answer echoes the OLD price for a, plus a car from elsewhere.
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 200 }), car("b"), car("z")]));

    const onScreen = h.screen();
    expect(byId(onScreen, "a")).toMatchObject({ priceRetail: 300 }); // the newer edit survived
    expect(ids(onScreen)).toEqual(["a", "b", "z"]); // and the car from elsewhere is still picked up

    // The newer edit is what the follow-up save sends.
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "a", set: { priceRetail: 300 } }]);
  });

  it("a car deleted while a save was in flight does not come back from that save's answer", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);

    void edit(h, "a", { priceRetail: 1 }); // in flight; the server still has b
    void remove(h, "b"); // b deleted here meanwhile

    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("b")]));
    expect(ids(h.screen())).toEqual(["a"]);
    expect(h.calls[1]!.payload.deletedIds).toEqual(["b"]); // and its deletion is on its way
  });
});

// The bug the earlier "send the whole list" model could not have had, and the
// one a naive field-level model WOULD have: after a save, the server's copy of a
// car can carry someone else's edit that this screen hasn't seen. If the next
// diff were worked out by comparing the screen with the server, that edit would
// look like something the user did, and the next save would put it back.
describe("THE REVERT BUG: someone else's edit is never sent back as if this user had undone it", () => {
  it("the answer carries another person's new price for X while X has a waiting edit here: the screen shows both, and the next request for X carries ONLY this user's edit", async () => {
    const h = harness();
    h.saver.loaded([car("x", { priceRetail: 100, mileage: 1 }), car("y")]);

    void edit(h, "y", { priceRetail: 1 }); // a save is on its way
    void edit(h, "x", { mileage: 2 }); // this user edits X's mileage meanwhile; it waits

    // The server's answer: X's price was changed by someone else (100 -> 200).
    await h.calls[0]!.respond(ok([car("x", { priceRetail: 200, mileage: 1 }), car("y", { priceRetail: 1 })]));

    // Both edits are on screen: theirs (price) and ours (mileage).
    expect(byId(h.screen(), "x")).toMatchObject({ priceRetail: 200, mileage: 2 });

    // The follow-up carries the mileage and nothing else for X: never the price.
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "x", set: { mileage: 2 } }]);
    expect(JSON.stringify(h.calls[1]!.payload)).not.toContain("priceRetail");

    // ...and it stays that way through the next answer and the next edit.
    await h.calls[1]!.respond(ok([car("x", { priceRetail: 200, mileage: 2 }), car("y", { priceRetail: 1 })]));
    expect(byId(h.screen(), "x")).toMatchObject({ priceRetail: 200, mileage: 2 });
    void edit(h, "x", { notes: "Two keys" });
    expect(h.calls[2]!.payload.changes).toEqual([{ id: "x", set: { notes: "Two keys" } }]);
  });

  it("the same, when the save failed and is tried again after the other person's edit arrived by a sync", async () => {
    const h = harness();
    h.saver.loaded([car("x", { priceRetail: 100, mileage: 1 })]);
    void edit(h, "x", { mileage: 2 });
    await h.calls[0]!.respond(failed());

    // Someone else changes the price; the next attempt's answer carries it.
    void h.saver.retry();
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "x", set: { mileage: 2 } }]);
    await h.calls[1]!.respond(ok([car("x", { priceRetail: 200, mileage: 2 })]));
    expect(byId(h.screen(), "x")).toMatchObject({ priceRetail: 200, mileage: 2 });

    // Later edits still mention neither the price nor the mileage.
    void edit(h, "x", { notes: "n" });
    expect(h.calls[2]!.payload.changes).toEqual([{ id: "x", set: { notes: "n" } }]);
  });

  it("someone else's edit to a car this screen edited a DIFFERENT car of is never sent at all", async () => {
    const h = harness();
    h.saver.loaded([car("x", { priceRetail: 100 }), car("y")]);
    void edit(h, "y", { mileage: 1 });
    await h.calls[0]!.respond(ok([car("x", { priceRetail: 999, colour: "Red" }), car("y", { mileage: 1 })]));
    expect(byId(h.screen(), "x")).toMatchObject({ priceRetail: 999, colour: "Red" });

    void edit(h, "y", { mileage: 2 });
    void edit(h, "y", { mileage: 3 });
    await h.calls[1]!.respond(ok([car("x", { priceRetail: 999, colour: "Red" }), car("y", { mileage: 2 })]));
    for (const call of h.calls) {
      expect(call.payload.changes.every(c => c.id === "y")).toBe(true);
      expect(JSON.stringify(call.payload)).not.toContain("999");
      expect(JSON.stringify(call.payload)).not.toContain("Red");
    }
  });

  it("someone else's removal of a field isn't sent back as an edit either", async () => {
    const h = harness();
    h.saver.loaded([car("x", { notes: "old note", mileage: 1 })]);
    void edit(h, "x", { mileage: 2 });
    await h.calls[0]!.respond(ok([car("x", { mileage: 2 })])); // the note was removed elsewhere
    expect(byId(h.screen(), "x")).not.toHaveProperty("notes", "old note");
    void edit(h, "x", { mileage: 3 });
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "x", set: { mileage: 3 } }]);
  });
});

describe("taking in the server's answer", () => {
  it("shows cars added elsewhere when nothing was edited while the save was on its way, and never sends them", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 });

    // The server also holds c, added on another screen.
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("c")]));
    expect(ids(h.screen())).toEqual(["a", "c"]);

    void edit(h, "a", { priceRetail: 2 });
    expect(h.calls[1]!.payload).toEqual({ items: [], changes: [{ id: "a", set: { priceRetail: 2 } }], deletedIds: [] });
  });

  it("a car edited by someone else that this screen never touched shows up after a save, and is never sent", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b", { priceRetail: 100 })]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("b", { priceRetail: 999 })]));
    expect(byId(h.screen(), "b")).toMatchObject({ priceRetail: 999 });

    void edit(h, "a", { priceRetail: 2 });
    await h.calls[1]!.respond(ok([car("a", { priceRetail: 2 }), car("b", { priceRetail: 999 })]));
    void edit(h, "a", { priceRetail: 3 });
    for (const call of h.calls) expect(call.payload.changes.map(c => c.id)).toEqual(["a"]);
    expect(h.calls.map(c => JSON.stringify(c.payload)).join()).not.toContain("999");
  });

  it("a car deleted by someone else disappears, and no later save mentions it", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 })])); // b is gone from the server
    expect(ids(h.screen())).toEqual(["a"]);

    void edit(h, "a", { priceRetail: 2 });
    expect(h.calls[1]!.payload).toEqual({ items: [], changes: [{ id: "a", set: { priceRetail: 2 } }], deletedIds: [] });
  });

  it("a car created here and not yet on the server stays after an answer that doesn't have it, after the server's own cars", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 }); // in flight
    void add(h, car("n")); // created meanwhile
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("c")]));
    expect(ids(h.screen())).toEqual(["a", "c", "n"]);
    expect(h.calls[1]!.payload.items.map(v => v.id)).toEqual(["n"]);
  });

  it("a car created here that the answer already lists keeps the version the user has, and is still sent", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 }); // in flight
    void add(h, car("n", { priceRetail: 7 })); // created meanwhile: not part of that request
    const mine = byId(h.screen(), "n");

    // The answer happens to list a car with that id too (an older copy).
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("n", { priceRetail: 2 })]));
    expect(byId(h.screen(), "n")).toBe(mine);
    expect(byId(h.screen(), "n")).toMatchObject({ priceRetail: 7 });
    expect(h.calls[1]!.payload.items.map(v => v.id)).toEqual(["n"]);
  });

  it("picks up a photo the server added to a car in the list", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1, images: ["http://x/photos/1.jpg"] })]));
    expect(h.screen()[0]!.images).toEqual(["http://x/photos/1.jpg"]);
    expect(h.screen()[0]).toMatchObject({ priceRetail: 1 });
  });

  it("if the answer can't be prepared for display, the save still counts and the screen is kept", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness({
      prepare: list => {
        if (list.some(v => v.id === "z")) throw new Error("enrichment blew up");
        return list;
      },
    });
    h.saver.loaded([car("a")]);
    const done = edit(h, "a", { priceRetail: 1 });

    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("z")]));
    expect(ids(h.screen())).toEqual(["a"]);
    expect(h.lastStatus()).toEqual({ saving: false, error: null, unsaved: false, notice: null });
    await expect(done).resolves.toBeUndefined(); // the failure to show it isn't an error for whoever made the edit
  });

  it("prepares what it adopts: new cars, and cars someone else changed with this user's waiting edit on top", async () => {
    const h = harness({ prepare: list => list.map(v => ({ ...v, prepared: true }) as unknown as Vehicle) });
    h.saver.loaded([car("a", { priceRetail: 100 }), car("q")]);
    expect(h.screen()[0]).toMatchObject({ prepared: true });

    void edit(h, "q", { mileage: 1 }); // in flight
    void edit(h, "a", { mileage: 2 }); // waiting
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 999 }), car("q", { mileage: 1 }), car("n")]));

    expect(byId(h.screen(), "n")).toMatchObject({ prepared: true });
    expect(byId(h.screen(), "a")).toMatchObject({ prepared: true, priceRetail: 999, mileage: 2 });
    // what is sent is never what preparing added
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "a", set: { mileage: 2 } }]);
  });

  it("a car with no id is shown as it is, never sent, and doesn't stop the rest working", async () => {
    const h = harness();
    const odd = { make: "Odd", model: "One" } as unknown as Vehicle;
    h.saver.loaded([car("a"), odd]);
    expect(h.screen()).toHaveLength(2);

    void edit(h, "a", { priceRetail: 1 });
    expect(h.calls[0]!.payload).toEqual({ items: [], changes: [{ id: "a", set: { priceRetail: 1 } }], deletedIds: [] });
    const updates = h.shown.length;
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), { make: "Odd", model: "One" } as unknown as Vehicle]));
    expect(h.screen()).toHaveLength(2);
    expect(h.shown).toHaveLength(updates); // the same stock: no churn, even for the entry with no id
  });

  it("a car whose id is an empty string can't be told apart from another: shown, never sent", async () => {
    const h = harness();
    const blank = { id: "", make: "Blank", model: "One" } as unknown as Vehicle;
    h.saver.loaded([car("a"), blank]);
    await edit(h, "", { priceRetail: 1 }); // the screen edits "the car with id ''"
    await h.saver.change([...h.screen(), { id: "", make: "Blank", model: "Two" } as unknown as Vehicle]);
    expect(h.calls).toHaveLength(0);
    expect(h.saver.hasUnsaved()).toBe(false);
  });

  it("the same id twice on the server doesn't confuse it", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("a", { priceRetail: 1 })]);
    void edit(h, "a", { mileage: 5 });
    await h.calls[0]!.respond(ok([car("a", { mileage: 5 }), car("a", { priceRetail: 1 })]));
    expect(h.screen()).toHaveLength(2);
  });
});

describe("the screen doesn't churn", () => {
  it("leaves the screen alone when the answer teaches it nothing", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    const updates = h.shown.length;

    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("b")]));
    expect(h.shown).toHaveLength(updates); // no needless replacement of the list
  });

  it("a plain sync whose answer is the same stock doesn't replace the list either", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    const updates = h.shown.length;
    void h.saver.retry();
    await h.calls[0]!.respond(ok([car("a"), car("b")])); // new objects, same content
    expect(h.shown).toHaveLength(updates);
  });

  it("a car created here isn't rebuilt when the server confirms it: the screen keeps the very object", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void add(h, car("n"));
    const mine = byId(h.screen(), "n");
    const updates = h.shown.length;

    await h.calls[0]!.respond(ok([car("a"), car("n")]));
    expect(h.shown).toHaveLength(updates);
    expect(byId(h.screen(), "n")).toBe(mine);
  });

  it("once another person's edit has been taken in, an answer holding the same thing doesn't replace the list again", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void h.saver.retry();
    await h.calls[0]!.respond(ok([car("a"), car("b", { priceRetail: 999 })])); // someone changed b
    expect(byId(h.screen(), "b")).toMatchObject({ priceRetail: 999 });
    const updates = h.shown.length;
    const before = [...h.screen()];

    void h.saver.retry();
    await h.calls[1]!.respond(ok([car("a"), car("b", { priceRetail: 999 })])); // and nothing since
    expect(h.shown).toHaveLength(updates);
    expect(h.screen()[1]).toBe(before[1]);
  });

  it("a car whose pictures are null on the server and an empty list here isn't a change", async () => {
    const h = harness();
    h.saver.loaded([car("a", { images: ["/p/1.jpg"] })]);
    void edit(h, "a", { images: [] }); // the user removed the last picture
    const updates = h.shown.length;
    await h.calls[0]!.respond(ok([car("a", { images: null })])); // the server tidies an empty list into null
    expect(h.shown).toHaveLength(updates);
    expect(h.screen()[0]!.images).toEqual([]);
  });

  it("when other cars change, the cars that didn't keep the very same objects", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b"), car("c")]);
    const before = [...h.screen()];

    void h.saver.retry();
    await h.calls[0]!.respond(ok([car("a"), car("b", { priceRetail: 999 }), car("c")]));

    const after = h.screen();
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[1]).toMatchObject({ priceRetail: 999 });
  });

  it("when a car arrives from elsewhere, the cars already there keep the very same objects", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    const before = [...h.screen()];
    void h.saver.retry();
    await h.calls[0]!.respond(ok([car("a"), car("b"), car("c")]));
    expect(h.screen()[0]).toBe(before[0]);
    expect(h.screen()[1]).toBe(before[1]);
    expect(ids(h.screen())).toEqual(["a", "b", "c"]);
  });

  it("a car the user has edited keeps its object when the answer is what was expected", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    void edit(h, "a", { mileage: 7 }); // waiting
    const mine = byId(h.screen(), "a");
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("b")]));
    expect(byId(h.screen(), "a")).toBe(mine);
  });
});

describe("retry", () => {
  it("with nothing waiting, sends an empty payload and adopts the answer: that is the sync", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void h.saver.retry();
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.payload).toEqual(NOTHING);

    await h.calls[0]!.respond(ok([car("a"), car("b", { priceRetail: 42 })]));
    expect(ids(h.screen())).toEqual(["a", "b"]);
    expect(h.saver.hasUnsaved()).toBe(false);
  });

  it("while a save is on its way, waits for it: still one request at a time", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 });
    void h.saver.retry();
    void h.saver.retry();
    expect(h.calls).toHaveLength(1);
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 })]));
    expect(h.calls).toHaveLength(2); // one follow-up, not two
    expect(h.calls[1]!.payload).toEqual(NOTHING);
  });
});

describe("cars someone else deleted while this user was editing them", () => {
  const withReg = (id: string, reg: string, extra: Record<string, unknown> = {}) => car(id, { reg, ...extra });

  it("the edit is dropped, the notice names the car and is in the status, and the car leaves the screen", async () => {
    const h = harness();
    h.saver.loaded([withReg("a", "AB12 CDE"), car("b", { make: "BMW", model: "1 Series" })]);
    void edit(h, "a", { priceRetail: 1 });

    await h.calls[0]!.respond(okNotFound([car("b", { make: "BMW", model: "1 Series" })], ["a"]));

    expect(h.lastStatus().notice).toBe(`"Ford Fiesta (AB12 CDE)" was deleted by someone else, so your change to it wasn't saved.`);
    expect(ids(h.screen())).toEqual(["b"]);
    expect(h.saver.hasUnsaved()).toBe(false);
    expect(h.lastStatus().error).toBeNull();
    expect(h.calls).toHaveLength(1); // nothing left to send
  });

  it("does not create the car again: no later save mentions it", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(okNotFound([car("b")], ["a"]));
    void edit(h, "b", { priceRetail: 2 });
    expect(h.calls[1]!.payload).toEqual({ items: [], changes: [{ id: "b", set: { priceRetail: 2 } }], deletedIds: [] });
  });

  it("an edit made to that car in the meantime is dropped as well, not sent again", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    void edit(h, "a", { mileage: 9 }); // in flight
    await h.calls[0]!.respond(okNotFound([car("b")], ["a"]));
    expect(h.calls).toHaveLength(2); // the follow-up exists, but carries nothing for a
    expect(h.calls[1]!.payload).toEqual(NOTHING);
    expect(ids(h.screen())).toEqual(["b"]);
  });

  it("the notice survives a later successful save, and dismissing it clears it", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(okNotFound([car("b")], ["a"]));
    const message = h.lastStatus().notice;
    expect(message).toContain("Ford Fiesta");

    void edit(h, "b", { priceRetail: 5 });
    await h.calls[1]!.respond(ok([car("b", { priceRetail: 5 })]));
    expect(h.lastStatus()).toEqual({ saving: false, error: null, unsaved: false, notice: message });

    h.saver.dismissNotice();
    expect(h.lastStatus().notice).toBeNull();
    void edit(h, "b", { priceRetail: 6 });
    await h.calls[2]!.respond(ok([car("b", { priceRetail: 6 })]));
    expect(h.lastStatus().notice).toBeNull();
  });

  it("the notice also survives a failed save", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(okNotFound([car("b")], ["a"]));
    void edit(h, "b", { priceRetail: 5 });
    await h.calls[1]!.respond(failed());
    expect(h.lastStatus().notice).toContain("deleted by someone else");
    expect(h.lastStatus().error).toBe("no luck");
  });

  it("two cars found missing in one save: one notice listing both", async () => {
    const h = harness();
    h.saver.loaded([withReg("a", "AB12 CDE"), car("b", { make: "BMW", model: "1 Series" }), car("c")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(failed());
    void edit(h, "b", { priceRetail: 2 }); // both edits go in this request
    expect(h.calls[1]!.payload.changes.map(c => c.id)).toEqual(["a", "b"]);

    await h.calls[1]!.respond(okNotFound([car("c")], ["a", "b"]));
    expect(h.lastStatus().notice).toBe(
      `Some cars were deleted by someone else, so your changes to them weren't saved: "Ford Fiesta (AB12 CDE)" and "BMW 1 Series".`
    );
    expect(ids(h.screen())).toEqual(["c"]);
  });

  it("a second discovery adds to the notice the user hasn't read yet, rather than replacing it", async () => {
    const h = harness();
    h.saver.loaded([withReg("a", "AB12 CDE"), car("b", { make: "BMW", model: "1 Series" }), car("c")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(okNotFound([car("b", { make: "BMW", model: "1 Series" }), car("c")], ["a"]));
    void edit(h, "b", { priceRetail: 2 });
    await h.calls[1]!.respond(okNotFound([car("c")], ["b"]));

    const notice = h.lastStatus().notice!;
    expect(notice).toContain("Ford Fiesta (AB12 CDE)");
    expect(notice).toContain("BMW 1 Series");

    h.saver.dismissNotice();
    void edit(h, "c", { priceRetail: 2 });
    await h.calls[2]!.respond(okNotFound([], ["c"]));
    expect(h.lastStatus().notice).toBe(`"Ford Fiesta" was deleted by someone else, so your change to it wasn't saved.`); // a fresh one
  });

  it("names the car as it was on screen, including the user's own edit of its name", async () => {
    const h = harness();
    h.saver.loaded([withReg("a", "AB12 CDE")]);
    void edit(h, "a", { model: "Focus" });
    await h.calls[0]!.respond(okNotFound([], ["a"]));
    expect(h.lastStatus().notice).toContain("Ford Focus (AB12 CDE)");
  });

  it("still names a car that left the screen earlier, with its edit waiting", async () => {
    const h = harness();
    h.saver.loaded([withReg("a", "AB12 CDE"), car("b")]);
    void edit(h, "b", { priceRetail: 1 }); // save 1 in flight
    void edit(h, "a", { priceRetail: 2 }); // waiting

    // Save 1's answer already lacks a (deleted elsewhere), and says nothing about it: it carried no edit for a.
    await h.calls[0]!.respond(ok([car("b", { priceRetail: 1 })]));
    expect(ids(h.screen())).toEqual(["b"]);
    expect(h.lastStatus().notice).toBeNull(); // not told yet
    expect(h.calls[1]!.payload.changes).toEqual([{ id: "a", set: { priceRetail: 2 } }]);

    await h.calls[1]!.respond(okNotFound([car("b", { priceRetail: 1 })], ["a"]));
    expect(h.lastStatus().notice).toBe(`"Ford Fiesta (AB12 CDE)" was deleted by someone else, so your change to it wasn't saved.`);
    expect(h.saver.hasUnsaved()).toBe(false);
  });

  it("says the car couldn't be named when there is nothing to name it by", async () => {
    const h = harness();
    h.saver.loaded([{ id: "a", priceRetail: 1 } as unknown as Vehicle]);
    void edit(h, "a", { priceRetail: 2 });
    await h.calls[0]!.respond(okNotFound([], ["a"]));
    expect(h.lastStatus().notice).toBe("A car was deleted by someone else, so your change to it wasn't saved.");
  });

  it("an id the server reports that this save didn't carry an edit for is ignored", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(okNotFound([car("a", { priceRetail: 1 }), car("b")], ["b", "ghost"]));
    expect(h.lastStatus().notice).toBeNull();
    expect(ids(h.screen())).toEqual(["a", "b"]);
  });

  it("nothing is said when the user deleted the car themselves too", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    void remove(h, "a");
    await h.calls[0]!.respond(okNotFound([car("b")], ["a"]));
    expect(h.lastStatus().notice).toBeNull();
    expect(h.calls[1]!.payload).toEqual({ items: [], changes: [], deletedIds: ["a"] });
  });

  it("dismissing when there is no notice changes nothing", () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    const updates = h.statuses.length;
    h.saver.dismissNotice();
    expect(h.statuses).toHaveLength(updates);
  });

  it("a different login starts with no notice, and the old login's answer can't raise one", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(failed());
    void h.saver.retry(); // an edit of a waits on the way
    h.saver.reset();
    expect(h.lastStatus()).toEqual({ saving: false, error: null, unsaved: false, notice: null });

    h.saver.loaded([car("x")]);
    await h.calls[1]!.respond(okNotFound([], ["a"])); // the old login's answer lands late
    expect(h.lastStatus().notice).toBeNull();
    expect(ids(h.screen())).toEqual(["x"]);
  });

  it("a reset clears a notice that was showing", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(okNotFound([], ["a"]));
    expect(h.lastStatus().notice).not.toBeNull();
    h.saver.reset();
    expect(h.lastStatus().notice).toBeNull();
    h.saver.loaded([car("x")]);
    expect(h.lastStatus().notice).toBeNull();
  });
});

describe("a different login", () => {
  it("drops the answer of a save that was still on its way, and forgets everything unconfirmed", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void remove(h, "a");
    void add(h, car("n"));

    h.saver.reset(); // logged out / another account
    expect(h.screen()).toEqual([]);
    expect(h.saver.isReady()).toBe(false);

    h.saver.loaded([car("x")]);
    await h.calls[0]!.respond(ok([car("b")])); // the OLD login's answer finally lands
    expect(ids(h.screen())).toEqual(["x"]); // and changes nothing

    void edit(h, "x", { priceRetail: 1 });
    // neither the old login's deletion nor its new car is sent for this one
    expect(h.calls[1]!.payload).toEqual({ items: [], changes: [{ id: "x", set: { priceRetail: 1 } }], deletedIds: [] });
  });

  it("an edit that was waiting isn't sent for the next login", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(failed());
    h.saver.reset();
    h.saver.loaded([car("a", { priceRetail: 7 })]); // a car with the same id in another dealership
    void h.saver.retry();
    expect(h.calls[1]!.payload).toEqual(NOTHING);
  });

  it("a save from the previous login finishing late doesn't upset the new login's save that is still on its way", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 }); // the old login's save (call 0)

    h.saver.reset();
    h.saver.loaded([car("x")]);
    void edit(h, "x", { priceRetail: 2 }); // the new login's save (call 1)
    expect(h.calls).toHaveLength(2);

    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 })])); // the old one lands late
    expect(h.lastStatus().saving).toBe(true); // the new login's save is still on its way

    // Still one at a time: this waits for call 1 rather than starting a third request.
    void edit(h, "x", { priceRetail: 3 });
    expect(h.calls).toHaveLength(2);
    await h.calls[1]!.respond(ok([car("x", { priceRetail: 2 })]));
    expect(h.calls).toHaveLength(3);
    expect(h.calls[2]!.payload.changes).toEqual([{ id: "x", set: { priceRetail: 3 } }]);
  });

  it("a failed answer from the previous login doesn't put an error on the new login", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 });
    h.saver.reset();
    h.saver.loaded([car("x")]);
    await h.calls[0]!.respond(failed("old login's failure"));
    expect(h.lastStatus().error).toBeNull();
  });
});

describe("refreshing (reading the stock again)", () => {
  it("is adopted when nothing was edited since the read began", () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    const stamp = h.saver.stamp();
    expect(h.saver.adoptRefresh(stamp, [car("a"), car("b")])).toBe(true);
    expect(ids(h.screen())).toEqual(["a", "b"]);
  });

  it("takes in another person's edit to a car, and leaves the other cars' objects alone", () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    const before = [...h.screen()];
    expect(h.saver.adoptRefresh(h.saver.stamp(), [car("a"), car("b", { priceRetail: 999 })])).toBe(true);
    expect(h.screen()[0]).toBe(before[0]);
    expect(h.screen()[1]).toMatchObject({ priceRetail: 999 });
  });

  it("changes nothing on screen when the read holds nothing new", () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    const updates = h.shown.length;
    expect(h.saver.adoptRefresh(h.saver.stamp(), [car("a"), car("b")])).toBe(true);
    expect(h.shown).toHaveLength(updates);
  });

  it("is dropped when the dealer edited something while it was on its way", () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    const stamp = h.saver.stamp();
    void edit(h, "a", { priceRetail: 1 }); // edited after the read began

    expect(h.saver.adoptRefresh(stamp, [car("a", { priceRetail: 5000 }), car("b")])).toBe(false);
    expect(h.screen()[0]).toMatchObject({ priceRetail: 1 });
    expect(ids(h.screen())).toEqual(["a"]);
  });

  it("is dropped while changes are unsaved, including after a failed save", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 });
    await h.calls[0]!.respond(failed());

    expect(h.saver.hasUnsaved()).toBe(true);
    expect(h.saver.adoptRefresh(h.saver.stamp(), [car("a", { priceRetail: 5000 })])).toBe(false);
    expect(h.screen()[0]).toMatchObject({ priceRetail: 1 });
  });

  it("is dropped while a save is on its way", () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void edit(h, "a", { priceRetail: 1 }); // in flight
    expect(h.saver.adoptRefresh(h.saver.stamp(), [car("a", { priceRetail: 5000 })])).toBe(false);
    expect(h.screen()[0]).toMatchObject({ priceRetail: 1 });
  });

  it("is dropped while a sync's save is on its way, and adopted once that has finished", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void h.saver.retry(); // nothing waiting, but a request is in flight
    expect(h.saver.adoptRefresh(h.saver.stamp(), [car("a"), car("b")])).toBe(false);
    await h.calls[0]!.respond(ok([car("a")]));
    expect(h.saver.adoptRefresh(h.saver.stamp(), [car("a"), car("b")])).toBe(true);
  });

  it("is dropped if the login changed after the read began", () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    const stamp = h.saver.stamp();
    h.saver.reset();
    h.saver.loaded([car("x")]);
    expect(h.saver.adoptRefresh(stamp, [car("a")])).toBe(false);
    expect(ids(h.screen())).toEqual(["x"]);
  });

  it("is dropped if the dealer edited after the read began, even once that edit has been saved", async () => {
    const h = harness();
    h.saver.loaded([car("a", { priceRetail: 100 })]);
    const stamp = h.saver.stamp(); // the read begins here...
    void edit(h, "a", { priceRetail: 200 }); // ...the dealer edits...
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 200 })])); // ...and that is saved before the read comes back
    expect(h.saver.hasUnsaved()).toBe(false);

    // The read went out before the edit, so it still holds the old price.
    expect(h.saver.adoptRefresh(stamp, [car("a", { priceRetail: 100 })])).toBe(false);
    expect(h.screen()[0]).toMatchObject({ priceRetail: 200 });
  });

  it("is dropped if this login's stock hasn't loaded yet", () => {
    const h = harness();
    expect(h.saver.adoptRefresh(h.saver.stamp(), [car("a")])).toBe(false);
    expect(h.screen()).toEqual([]);
  });

  it("if the read can't be prepared for display it throws and the screen is kept", () => {
    const h = harness({
      prepare: list => {
        if (list.some(v => v.id === "z")) throw new Error("enrichment blew up");
        return list;
      },
    });
    h.saver.loaded([car("a")]);
    expect(() => h.saver.adoptRefresh(h.saver.stamp(), [car("a"), car("z")])).toThrow("enrichment blew up");
    expect(ids(h.screen())).toEqual(["a"]);
  });

  it("does not bring back a car the dealer deleted, or hide a later change", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void remove(h, "a");
    await h.calls[0]!.respond(ok([car("b")]));
    expect(h.saver.adoptRefresh(h.saver.stamp(), [car("b"), car("c")])).toBe(true);
    expect(ids(h.screen())).toEqual(["b", "c"]);
  });
});

describe("loading", () => {
  it("throws, and changes nothing, if the stock can't be prepared", () => {
    const h = harness({
      prepare: () => {
        throw new Error("nope");
      },
    });
    expect(() => h.saver.loaded([car("a")])).toThrow("nope");
    expect(h.saver.isReady()).toBe(false);
    expect(h.screen()).toEqual([]);
  });

  it("prepares what it loads, and is then ready", () => {
    const h = harness({ prepare: list => list.map(v => ({ ...v, prepared: true }) as unknown as Vehicle) });
    h.saver.loaded([car("a")]);
    expect(h.saver.isReady()).toBe(true);
    expect(h.screen()[0]).toMatchObject({ prepared: true });
  });
});

describe("the status", () => {
  const base: SaverStatus = { saving: false, error: null, unsaved: false, notice: null };

  it("compares every part, including the notice", () => {
    expect(sameStatus(base, { ...base })).toBe(true);
    expect(sameStatus(base, { ...base, saving: true })).toBe(false);
    expect(sameStatus(base, { ...base, error: "x" })).toBe(false);
    expect(sameStatus(base, { ...base, unsaved: true })).toBe(false);
    expect(sameStatus(base, { ...base, notice: "x" })).toBe(false);
    expect(sameStatus({ ...base, notice: "x" }, { ...base, notice: "x" })).toBe(true);
  });
});

// A whole day of edits from this screen and someone else, straight against a
// fake server that follows the contract, with saves that fail before reaching
// the server, saves the server applied but whose answer never arrived, and
// answers that land late. Whatever happens, at the end: nothing the user did
// here is lost, nothing the other person did to a field this screen never
// touched is undone, no deleted car is back, and the screen matches the server.
describe("a whole day of edits from two screens (randomised, seeded)", () => {
  const MINE = ["priceRetail", "mileage", "notes"] as const; // edited on the screen under test
  const THEIRS = ["colour", "year", "condition"] as const; // edited by "someone else", on the server
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

  function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  async function oneDay(seed: number) {
    const rand = mulberry32(seed);
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
    const int = () => Math.floor(rand() * 1000);
    // Lets the saver run everything that follows an answer (a few promise hops).
    const tick = async () => {
      for (let i = 0; i < 30; i++) await Promise.resolve();
    };
    const fail = (): SaveResult => ({ ok: false, status: 500, message: "boom" });

    // The fake server, following the contract.
    let server: Record<string, unknown>[] = [];
    function apply(p: SavePayload): { items: Vehicle[]; notFound: string[] } {
      const deleted = new Set(p.deletedIds);
      for (const item of p.items as unknown as Record<string, unknown>[]) {
        if (deleted.has(item.id as string)) continue;
        const at = server.findIndex(c => c.id === item.id);
        if (at >= 0) server[at] = clone(item);
        else server.push(clone(item));
      }
      server = server.filter(c => !deleted.has(c.id as string));
      const notFound: string[] = [];
      for (const change of p.changes) {
        if (deleted.has(change.id)) continue;
        const target = server.find(c => c.id === change.id);
        if (!target) {
          if (!notFound.includes(change.id)) notFound.push(change.id);
          continue;
        }
        for (const key of change.unset ?? []) delete target[key];
        for (const [key, value] of Object.entries(change.set ?? {})) target[key] = clone(value);
      }
      return { items: clone(server) as unknown as Vehicle[], notFound };
    }

    // The link to the fake server: each request is applied the moment it is
    // sent (or not at all, or applied with its answer lost), and its answer is
    // held until the test decides it lands.
    const sent: SavePayload[] = [];
    let reply: { resolve: (r: SaveResult) => void; result: SaveResult } | null = null;
    let reliable = false;
    const saver = createInventorySaver({
      send: payload =>
        new Promise<SaveResult>(resolve => {
          sent.push(clone(payload));
          const roll = reliable ? 1 : rand();
          let result: SaveResult;
          if (roll < 0.12) result = fail();
          else if (roll < 0.2) {
            apply(clone(payload));
            result = fail();
          } else {
            const answer = apply(clone(payload));
            result = { ok: true, items: answer.items, notFound: answer.notFound };
          }
          reply = { resolve, result };
        }),
      onVehicles: () => {},
      onStatus: () => {},
    });
    const deliver = async () => {
      const held = reply;
      reply = null;
      if (held) held.resolve(held.result);
      await tick();
    };

    const starting = [0, 1, 2, 3, 4].map(i => ({
      id: `s${i}`,
      make: "Ford",
      model: `M${i}`,
      priceRetail: 1000 + i,
      mileage: 100 + i,
      notes: null,
      colour: "White",
      year: 2010 + i,
      condition: "Good",
    }));
    server = clone(starting);
    saver.loaded(clone(starting) as unknown as Vehicle[]);

    const created = new Set<string>(); // cars this screen created
    const deletedHere = new Set<string>();
    const deletedThere = new Set<string>();
    const mineLast = new Map<string, Record<string, unknown>>(); // this screen's last value of each of its fields, per car
    const theirsLast = new Map<string, Record<string, unknown>>();
    let counter = 0;

    for (let step = 0; step < 90; step++) {
      const r = rand();
      const screen = saver.getList();
      if (r < 0.3 && screen.length > 0) {
        const target = pick(screen);
        const field = pick(MINE);
        const value = field === "notes" ? pick([undefined, null, `note ${int()}`]) : int();
        void saver.change(screen.map(v => (v.id === target.id ? ({ ...v, [field]: value } as Vehicle) : v)));
        mineLast.set(target.id, { ...(mineLast.get(target.id) ?? {}), [field]: value });
      } else if (r < 0.38) {
        const id = `n${counter++}`;
        const fresh = { id, make: "Audi", model: `N${id}`, priceRetail: int(), mileage: int(), notes: null, colour: "Blue", year: 2020, condition: "New" };
        void saver.change([...screen, fresh as unknown as Vehicle]);
        created.add(id);
        mineLast.set(id, { priceRetail: fresh.priceRetail, mileage: fresh.mileage, notes: null });
      } else if (r < 0.46 && screen.length > 0) {
        const target = pick(screen);
        void saver.change(
          screen.filter(v => v.id !== target.id),
          target.id
        );
        deletedHere.add(target.id);
        mineLast.delete(target.id);
      } else if (r < 0.6) {
        const candidates = server.filter(c => !created.has(c.id as string));
        if (candidates.length > 0) {
          const target = pick(candidates);
          const field = pick(THEIRS);
          const value = field === "year" ? 1990 + Math.floor(rand() * 30) : `${field}-${int()}`;
          target[field] = value;
          theirsLast.set(target.id as string, { ...(theirsLast.get(target.id as string) ?? {}), [field]: value });
        }
      } else if (r < 0.64) {
        const id = `t${counter++}`;
        const fresh = { id, make: "Kia", model: `T${id}`, priceRetail: int(), mileage: int(), notes: null, colour: "Red", year: 2015, condition: "Fair" };
        server.push(clone(fresh));
        theirsLast.set(id, { colour: "Red", year: 2015, condition: "Fair" });
        mineLast.set(id, { priceRetail: fresh.priceRetail, mileage: fresh.mileage, notes: null });
      } else if (r < 0.68) {
        const candidates = server.filter(c => !created.has(c.id as string));
        if (candidates.length > 0) {
          const target = pick(candidates);
          server = server.filter(c => c.id !== target.id);
          deletedThere.add(target.id as string);
        }
      } else if (r < 0.9) {
        await deliver();
      } else {
        void saver.retry();
      }
    }

    // Let everything through: every request now succeeds and every answer lands.
    reliable = true;
    const settleAll = async () => {
      for (let i = 0; i < 200; i++) {
        if (reply) await deliver();
        else if (saver.hasUnsaved()) {
          void saver.retry();
          await tick();
        } else break;
      }
    };
    await settleAll();
    void saver.retry(); // and one last sync, so the screen has seen everything
    await settleAll();

    const label = `seed ${seed}`;

    // 1. Nothing was ever sent that this screen's user didn't do.
    for (const payload of sent) {
      for (const item of payload.items) expect(created.has(item.id), `${label}: sent a whole car it didn't create (${item.id})`).toBe(true);
      for (const id of payload.deletedIds) expect(deletedHere.has(id), `${label}: deleted a car the user didn't (${id})`).toBe(true);
      for (const change of payload.changes) {
        for (const key of [...Object.keys(change.set ?? {}), ...(change.unset ?? [])]) {
          expect((MINE as readonly string[]).includes(key), `${label}: sent an edit of ${key}, which the user never touched`).toBe(true);
        }
      }
    }

    // 2. Deleted cars stay deleted, wherever they were deleted.
    const finalIds = new Set(server.map(c => c.id as string));
    for (const id of deletedHere) expect(finalIds.has(id), `${label}: ${id} deleted here came back`).toBe(false);
    for (const id of deletedThere) expect(finalIds.has(id), `${label}: ${id} deleted elsewhere came back`).toBe(false);

    // 3. Every field either person set last is what the server holds.
    for (const car of server) {
      const id = car.id as string;
      for (const [key, value] of Object.entries(mineLast.get(id) ?? {})) {
        expect(sameJson(car[key], value), `${label}: ${id}.${key} should be ${JSON.stringify(value)} (this screen's last edit), is ${JSON.stringify(car[key])}`).toBe(true);
      }
      for (const [key, value] of Object.entries(theirsLast.get(id) ?? {})) {
        expect(car[key], `${label}: ${id}.${key} should be ${JSON.stringify(value)} (the other person's edit)`).toEqual(value);
      }
    }

    // 4. The screen shows exactly what the server holds, and nothing is left waiting.
    const finalScreen = saver.getList();
    expect(finalScreen.map(v => v.id), `${label}: the screen's cars`).toEqual(server.map(c => c.id as string));
    for (const [i, shownCar] of finalScreen.entries()) {
      expect(sameJson(shownCar, server[i]), `${label}: ${shownCar.id} on screen differs from the server`).toBe(true);
    }
    expect(saver.hasUnsaved(), `${label}: still unsaved`).toBe(false);
  }

  const sameJson = (a: unknown, b: unknown) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
  function sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, inner]) => inner !== undefined)
          .sort(([x], [y]) => (x < y ? -1 : 1))
          .map(([key, inner]) => [key, sortKeys(inner)])
      );
    }
    return value;
  }

  it("holds for 60 different days", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (let seed = 1; seed <= 60; seed++) await oneDay(seed);
  }, 60_000);
});
