import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createUndoableAction } from "./undoableAction";
import { createInventorySaver, type SaveResult } from "../context/inventorySaver";
import type { Vehicle } from "../types/Vehicle";

// Delete Vehicle's "Delete Forever, with an Undo toast". The original did the
// countdown in a setInterval that read a `pendingDelete` state variable — the
// value from the render where the button was clicked, which never changes — so
// deleteVehicle was never called and the car stayed in stock (and on the public
// store page) while the toast said "Vehicle Deleted".

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(seconds = 10) {
  const committed: { payload: string; reason: string }[] = [];
  const ticks: number[] = [];
  const action = createUndoableAction<string>({
    seconds,
    onTick: n => ticks.push(n),
    onCommit: (payload, reason) => committed.push({ payload, reason }),
  });
  return { action, committed, ticks };
}

describe("the delete countdown", () => {
  it("really does it when the countdown runs out — once, for the right car", () => {
    const { action, committed, ticks } = setup();
    action.start("car-7");
    expect(ticks).toEqual([10]);

    vi.advanceTimersByTime(9_000);
    expect(committed).toEqual([]); // still time to change their mind
    expect(action.isPending()).toBe(true);

    vi.advanceTimersByTime(1_000);
    expect(committed).toEqual([{ payload: "car-7", reason: "expired" }]);
    expect(ticks).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    expect(action.isPending()).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(committed).toHaveLength(1); // never twice
    expect(vi.getTimerCount()).toBe(0);
  });

  it("Undo stops it: nothing is deleted, and the timer is gone", () => {
    const { action, committed } = setup();
    action.start("car-7");
    vi.advanceTimersByTime(4_000);
    action.undo();

    vi.advanceTimersByTime(60_000);
    expect(committed).toEqual([]);
    expect(action.isPending()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("closing the screen mid-countdown finishes the delete straight away, once", () => {
    const { action, committed } = setup();
    action.start("car-7");
    vi.advanceTimersByTime(3_000);

    action.flush();
    expect(committed).toEqual([{ payload: "car-7", reason: "closed" }]);
    vi.advanceTimersByTime(60_000);
    expect(committed).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("closing the screen when nothing is pending does nothing", () => {
    const { action, committed } = setup();
    action.flush();
    action.start("car-7");
    action.undo();
    action.flush();
    expect(committed).toEqual([]);
  });

  it("a second start while one is running is ignored, so it can't double up", () => {
    const { action, committed } = setup();
    action.start("car-7");
    vi.advanceTimersByTime(5_000);
    action.start("car-8");
    vi.advanceTimersByTime(5_000);
    expect(committed).toEqual([{ payload: "car-7", reason: "expired" }]);
  });

  it("can be used again after it has finished or been undone", () => {
    const { action, committed } = setup(2);
    action.start("a");
    action.undo();
    action.start("b");
    vi.advanceTimersByTime(2_000);
    action.start("c");
    vi.advanceTimersByTime(2_000);
    expect(committed.map(c => c.payload)).toEqual(["b", "c"]);
  });
});

// The whole path Delete Forever takes, minus the React component around it:
// the countdown ends -> deleteVehicle -> the save that carries the deletion.
describe("Delete Forever ends up sending the deletion to the server", () => {
  const car = (id: string) => ({ id, make: "Ford", model: "Fiesta", images: null }) as unknown as Vehicle;

  function wiring() {
    const sent: { ids: string[]; deletedIds: string[] }[] = [];
    const saver = createInventorySaver({
      send: async (list, deletedIds): Promise<SaveResult> => {
        sent.push({ ids: list.map(v => v.id), deletedIds });
        return { ok: true, items: list };
      },
      onVehicles: () => {},
      onStatus: () => {},
    });
    saver.loaded([car("keep"), car("doomed")]);
    // What InventoryProvider.deleteVehicle does:
    const deleteVehicle = (id: string) =>
      void saver.change(
        saver.getList().filter(v => v.id !== id),
        id
      );
    const action = createUndoableAction<string>({
      seconds: 10,
      onTick: () => {},
      onCommit: id => deleteVehicle(id),
    });
    return { saver, sent, action };
  }

  it("after the countdown, the car's id is sent as an explicit deletion", async () => {
    const { sent, action, saver } = wiring();
    action.start("doomed");
    expect(sent).toEqual([]); // nothing yet: still undoable

    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent).toEqual([{ ids: ["keep"], deletedIds: ["doomed"] }]);
    expect(saver.getList().map(v => v.id)).toEqual(["keep"]);
  });

  it("after Undo, nothing is sent and the car is still there", async () => {
    const { sent, action, saver } = wiring();
    action.start("doomed");
    await vi.advanceTimersByTimeAsync(5_000);
    action.undo();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent).toEqual([]);
    expect(saver.getList().map(v => v.id)).toEqual(["keep", "doomed"]);
  });
});
