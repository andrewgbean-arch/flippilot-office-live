import { describe, it, expect } from "vitest";
import { LoadGuard } from "./loadGuard";

// The rules for when a provider may save a list it holds in memory back
// to the server. Every one of these is a way a whole-list save can
// overwrite real data with something else.

describe("LoadGuard", () => {
  it("does not allow saving before any load has happened", () => {
    expect(new LoadGuard().canSave).toBe(false);
  });

  it("allows saving after a load succeeds", () => {
    const guard = new LoadGuard();
    const seq = guard.begin();
    expect(guard.succeed(seq)).toBe(true);
    expect(guard.canSave).toBe(true);
  });

  it("blocks saving while a load is in flight, since its response will replace what's in memory", () => {
    const guard = new LoadGuard();
    guard.succeed(guard.begin());
    guard.begin();
    expect(guard.canSave).toBe(false);
  });

  it("keeps saving blocked after a FIRST load fails (memory is empty, a save would erase the server's copy)", () => {
    const guard = new LoadGuard();
    const seq = guard.begin();
    expect(guard.fail(seq)).toBe("blocked");
    expect(guard.canSave).toBe(false);
  });

  it("keeps last-good data and re-enables saving when a REFRESH fails", () => {
    const guard = new LoadGuard();
    guard.succeed(guard.begin());
    const refresh = guard.begin();
    expect(guard.fail(refresh)).toBe("kept-last-good");
    expect(guard.canSave).toBe(true);
  });

  it("ignores a success from a load that a newer one superseded", () => {
    const guard = new LoadGuard();
    const slow = guard.begin();
    const fast = guard.begin();
    expect(guard.succeed(slow)).toBe(false);
    expect(guard.canSave).toBe(false);
    expect(guard.succeed(fast)).toBe(true);
    expect(guard.canSave).toBe(true);
  });

  it("ignores a failure from a load that a newer one superseded", () => {
    const guard = new LoadGuard();
    const slow = guard.begin();
    const fast = guard.begin();
    guard.succeed(fast);
    expect(guard.fail(slow)).toBe("superseded");
    expect(guard.canSave).toBe(true);
  });

  it("stops a slow response for the previous login landing in the new one", () => {
    const guard = new LoadGuard();
    const previousLogin = guard.begin();
    guard.invalidate(); // the login changed while that load was still in flight
    expect(guard.succeed(previousLogin)).toBe(false);
    expect(guard.canSave).toBe(false);
  });

  it("blocks saving once the login changes, however good the data in memory was", () => {
    const guard = new LoadGuard();
    guard.succeed(guard.begin());
    guard.invalidate();
    expect(guard.canSave).toBe(false);
  });

  it("does not treat the previous login's data as last-good for the new login", () => {
    const guard = new LoadGuard();
    guard.succeed(guard.begin());
    guard.invalidate();
    const firstLoadForNewLogin = guard.begin();
    expect(guard.fail(firstLoadForNewLogin)).toBe("blocked");
    expect(guard.canSave).toBe(false);
  });
});
