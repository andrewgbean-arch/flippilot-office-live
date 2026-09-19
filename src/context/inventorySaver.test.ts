import { describe, it, expect, vi, afterEach } from "vitest";
import {
  carsNewFromServer,
  createInventorySaver,
  sameStock,
  type InventorySaverOptions,
  type SaveResult,
  type SaverStatus,
} from "./inventorySaver";
import type { Vehicle } from "../types/Vehicle";

// The client's half of "a stale or partial screen must never delete cars":
// it sends deletions explicitly, forgets them only once the server confirms,
// keeps everything when a save fails, and takes in the server's answer
// without laying it over edits made while that save was on its way.

const car = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, make: "Ford", model: "Fiesta", images: null, priceRetail: 5000, ...extra }) as unknown as Vehicle;
const ids = (list: Vehicle[]) => list.map(v => v.id);

interface Call {
  list: Vehicle[];
  deletedIds: string[];
  respond: (result: SaveResult) => Promise<void>;
}

// A saver wired to a fake server we answer by hand, so the moment each
// answer lands (before or after more edits) is under the test's control.
function harness(extra: Partial<InventorySaverOptions> = {}) {
  const calls: Call[] = [];
  const shown: Vehicle[][] = [];
  const statuses: SaverStatus[] = [];
  const saver = createInventorySaver({
    send: (list, deletedIds) =>
      new Promise<SaveResult>(resolve => {
        calls.push({
          list,
          deletedIds,
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

const ok = (items: Vehicle[]): SaveResult => ({ ok: true, items });
const failed = (message = "no luck", status: number | null = 500): SaveResult => ({ ok: false, status, message });
const settle = () => new Promise(r => setTimeout(r, 0));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("carsNewFromServer", () => {
  it("returns cars the server has that aren't on screen", () => {
    expect(ids(carsNewFromServer([car("a"), car("b"), car("c")], [car("a")], new Set()))).toEqual(["b", "c"]);
    expect(carsNewFromServer([car("a")], [car("a"), car("z")], new Set())).toEqual([]);
  });

  it("leaves out a car the user deleted here whose deletion hasn't been confirmed yet", () => {
    expect(ids(carsNewFromServer([car("a"), car("b"), car("c")], [car("a")], new Set(["b"])))).toEqual(["c"]);
  });
});

describe("sameStock", () => {
  it("is true for the same cars in the same order with the same pictures", () => {
    expect(sameStock([car("a"), car("b")], [car("a", { priceRetail: 1 }), car("b")])).toBe(true);
    expect(sameStock([car("a", { images: null })], [car("a", { images: [] })])).toBe(true); // no pictures, either way
  });

  it("is false when a car, the order or a picture differs", () => {
    expect(sameStock([car("a"), car("b")], [car("a")])).toBe(false);
    expect(sameStock([car("a"), car("b")], [car("b"), car("a")])).toBe(false);
    expect(sameStock([car("a", { images: ["/photos/1.jpg"] })], [car("a")])).toBe(false);
    expect(sameStock([car("a", { images: ["/photos/1.jpg"] })], [car("a", { images: ["/photos/2.jpg"] })])).toBe(false);
  });
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

  it("a deletion made before the stock loaded is not sent once it has", async () => {
    const h = harness();
    await h.saver.change([], "ghost"); // not this login's real stock yet
    h.saver.loaded([car("a")]);

    void h.saver.change([car("a", { priceRetail: 1 })]);
    expect(h.calls[0]!.deletedIds).toEqual([]);
  });

  it("an ordinary edit sends the whole list and no deletions", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void h.saver.change([car("a", { priceRetail: 1 }), car("b")]);
    expect(h.calls).toHaveLength(1);
    expect(ids(h.calls[0]!.list)).toEqual(["a", "b"]);
    expect(h.calls[0]!.deletedIds).toEqual([]);
  });

  it("a deleted car's id is sent, and stops being sent once the server confirms it", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);

    void h.saver.change([car("b")], "a");
    expect(h.calls[0]!.deletedIds).toEqual(["a"]);
    expect(ids(h.calls[0]!.list)).toEqual(["b"]);
    // still on its way: not yet forgotten
    expect(h.saver.hasUnsaved()).toBe(true);

    await h.calls[0]!.respond(ok([car("b")]));
    expect(h.saver.hasUnsaved()).toBe(false);

    void h.saver.change([car("b", { priceRetail: 9 })]);
    expect(h.calls[1]!.deletedIds).toEqual([]);
  });

  it("deletions made during a save's flight are not forgotten when that save is confirmed", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b"), car("c")]);

    void h.saver.change([car("b"), car("c")], "a"); // in flight, carrying [a]
    void h.saver.change([car("c")], "b"); // deleted while that was on its way
    expect(h.calls).toHaveLength(1);

    await h.calls[0]!.respond(ok([car("b"), car("c")])); // confirms only a
    // the follow-up now carries b, and only b
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.deletedIds).toEqual(["b"]);
    expect(ids(h.calls[1]!.list)).toEqual(["c"]);
  });
});

describe("when a save fails", () => {
  it("keeps the list, the deletion and the reason, and does not retry by itself", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void h.saver.change([car("b", { priceRetail: 7 })], "a");

    await h.calls[0]!.respond(failed("Your stock is too big to save", 413));
    await settle();

    expect(h.calls).toHaveLength(1); // no retry loop
    expect(h.lastStatus()).toEqual({ saving: false, error: "Your stock is too big to save", unsaved: true });
    expect(h.saver.hasUnsaved()).toBe(true);
    expect(ids(h.screen())).toEqual(["b"]);
    expect(h.screen()[0]).toMatchObject({ priceRetail: 7 }); // the edit is still on screen
  });

  it("a retry resends everything, including the deletion, and success clears the error", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void h.saver.change([car("b", { priceRetail: 7 })], "a");
    await h.calls[0]!.respond(failed());

    void h.saver.retry();
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.deletedIds).toEqual(["a"]);
    expect(h.calls[1]!.list[0]).toMatchObject({ id: "b", priceRetail: 7 });

    await h.calls[1]!.respond(ok([car("b", { priceRetail: 7 })]));
    expect(h.lastStatus()).toEqual({ saving: false, error: null, unsaved: false });
    expect(h.saver.hasUnsaved()).toBe(false);
  });

  it("the next edit tries again too, not only the retry button", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void h.saver.change([car("a", { priceRetail: 1 })]);
    await h.calls[0]!.respond(failed());

    void h.saver.change([car("a", { priceRetail: 2 })]);
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.list[0]).toMatchObject({ priceRetail: 2 });
  });

  it("treats a send that throws as a failed save", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness({ send: () => Promise.reject(new Error("boom")) });
    h.saver.loaded([car("a")]);
    await h.saver.change([car("a", { priceRetail: 1 })]);
    expect(h.lastStatus().error).toContain("couldn't save");
    expect(h.lastStatus().unsaved).toBe(true);
  });

  it("reports that a save is on its way, and that it isn't once done", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void h.saver.change([car("a", { priceRetail: 1 })]);
    expect(h.lastStatus()).toMatchObject({ saving: true, unsaved: true });
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 })]));
    expect(h.lastStatus()).toEqual({ saving: false, error: null, unsaved: false });
  });
});

describe("taking in the server's answer", () => {
  it("shows cars added elsewhere when nothing was edited while the save was on its way", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void h.saver.change([car("a", { priceRetail: 1 })]);

    // The server also holds c, added on another screen.
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("c")]));
    expect(ids(h.screen())).toEqual(["a", "c"]);
  });

  it("picks up a photo the server added to a car in the list", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void h.saver.change([car("a", { priceRetail: 1 })]);
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1, images: ["http://x/photos/1.jpg"] })]));
    expect(h.screen()[0]!.images).toEqual(["http://x/photos/1.jpg"]);
  });

  it("does not lay the answer over an edit made while the save was in flight", async () => {
    const h = harness();
    h.saver.loaded([car("a", { priceRetail: 100 }), car("b")]);

    void h.saver.change([car("a", { priceRetail: 200 }), car("b")]); // save 1 in flight
    void h.saver.change([car("a", { priceRetail: 300 }), car("b")]); // edited again meanwhile

    // Save 1's answer echoes the OLD price for a, plus a car from elsewhere.
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 200 }), car("b"), car("z")]));

    const onScreen = h.screen();
    expect(onScreen.find(v => v.id === "a")).toMatchObject({ priceRetail: 300 }); // the newer edit survived
    expect(ids(onScreen)).toEqual(["a", "b", "z"]); // and the car from elsewhere is still picked up

    // The newer edit is what the follow-up save sends.
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.list.find(v => v.id === "a")).toMatchObject({ priceRetail: 300 });
  });

  it("a car deleted while a save was in flight does not come back from that save's answer", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);

    void h.saver.change([car("a", { priceRetail: 1 }), car("b")]); // in flight; the server still has b
    void h.saver.change([car("a", { priceRetail: 1 })], "b"); // b deleted here meanwhile

    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("b")]));
    expect(ids(h.screen())).toEqual(["a"]);
    expect(h.calls[1]!.deletedIds).toEqual(["b"]); // and its deletion is on its way
  });

  it("sends one save at a time: edits made during a flight go out together in one follow-up", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);

    void h.saver.change([car("a", { priceRetail: 1 })]);
    void h.saver.change([car("a", { priceRetail: 2 })]);
    void h.saver.change([car("a", { priceRetail: 3 })]);
    void h.saver.retry();
    expect(h.calls).toHaveLength(1); // nothing overtakes the save in flight

    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 })]));
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.list[0]).toMatchObject({ priceRetail: 3 });

    await h.calls[1]!.respond(ok([car("a", { priceRetail: 3 })]));
    expect(h.calls).toHaveLength(2); // and that's the last one
    expect(h.saver.hasUnsaved()).toBe(false);
  });

  it("leaves the screen alone when the answer teaches it nothing", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void h.saver.change([car("a", { priceRetail: 1 }), car("b")]);
    const updates = h.shown.length;

    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("b")]));
    expect(h.shown).toHaveLength(updates); // no needless replacement of the list
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
    void h.saver.change([car("a", { priceRetail: 1 })]);

    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("z")]));
    expect(ids(h.screen())).toEqual(["a"]);
    expect(h.lastStatus()).toEqual({ saving: false, error: null, unsaved: false });
  });

  it("prepares what it adopts", async () => {
    const h = harness({ prepare: list => list.map(v => ({ ...v, prepared: true }) as unknown as Vehicle) });
    h.saver.loaded([car("a")]);
    expect(h.screen()[0]).toMatchObject({ prepared: true });
    void h.saver.change([car("a", { priceRetail: 1 }), car("q")]);
    await h.calls[0]!.respond(ok([car("a", { priceRetail: 1 }), car("q"), car("n")]));
    expect(h.screen().find(v => v.id === "n")).toMatchObject({ prepared: true });
  });
});

describe("a different login", () => {
  it("drops the answer of a save that was still on its way, and forgets unconfirmed deletions", async () => {
    const h = harness();
    h.saver.loaded([car("a"), car("b")]);
    void h.saver.change([car("b")], "a");

    h.saver.reset(); // logged out / another account
    expect(h.screen()).toEqual([]);
    expect(h.saver.isReady()).toBe(false);

    h.saver.loaded([car("x")]);
    await h.calls[0]!.respond(ok([car("b")])); // the OLD login's answer finally lands
    expect(ids(h.screen())).toEqual(["x"]); // and changes nothing

    void h.saver.change([car("x", { priceRetail: 1 })]);
    expect(h.calls[1]!.deletedIds).toEqual([]); // the old login's deletion isn't sent for this one
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

  it("is dropped when the dealer edited something while it was on its way", () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    const stamp = h.saver.stamp();
    void h.saver.change([car("a", { priceRetail: 1 })]); // edited after the read began

    expect(h.saver.adoptRefresh(stamp, [car("a", { priceRetail: 5000 }), car("b")])).toBe(false);
    expect(h.screen()[0]).toMatchObject({ priceRetail: 1 });
    expect(ids(h.screen())).toEqual(["a"]);
  });

  it("is dropped while changes are unsaved, including after a failed save", async () => {
    const h = harness();
    h.saver.loaded([car("a")]);
    void h.saver.change([car("a", { priceRetail: 1 })]);
    await h.calls[0]!.respond(failed());

    expect(h.saver.hasUnsaved()).toBe(true);
    expect(h.saver.adoptRefresh(h.saver.stamp(), [car("a", { priceRetail: 5000 })])).toBe(false);
    expect(h.screen()[0]).toMatchObject({ priceRetail: 1 });
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
});
