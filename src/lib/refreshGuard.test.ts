import { describe, it, expect } from "vitest";
import { createRefreshGuard } from "./refreshGuard";

describe("createRefreshGuard", () => {
  it("a refresh that nothing interrupted stays current", () => {
    const guard = createRefreshGuard();
    const ticket = guard.begin();
    expect(ticket.isCurrent()).toBe(true);
  });

  it("anything that changes the list while a refresh is in flight makes that refresh's answer stale", () => {
    const guard = createRefreshGuard();
    const ticket = guard.begin();
    guard.bump(); // e.g. the person posted, or changed a status
    expect(ticket.isCurrent()).toBe(false);
  });

  it("a refresh started AFTER the change is current again", () => {
    const guard = createRefreshGuard();
    guard.bump();
    expect(guard.begin().isCurrent()).toBe(true);
  });

  it("overlapping refreshes are judged independently, and each change invalidates every earlier one", () => {
    const guard = createRefreshGuard();
    const first = guard.begin();
    const second = guard.begin();
    expect(first.isCurrent() && second.isCurrent()).toBe(true);
    guard.bump();
    const third = guard.begin();
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(false);
    expect(third.isCurrent()).toBe(true);
    guard.bump();
    expect(third.isCurrent()).toBe(false);
  });
});
