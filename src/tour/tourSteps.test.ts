import { describe, it, expect } from "vitest";
import { TOUR_STEPS, type TourStep } from "./tourSteps";

// Every new dealer now starts with no vehicles, and the tour runs on
// their first login. A step that points at something on a vehicle's row
// (or at a vehicle's own page) has nothing to spotlight then, so it must
// skip itself — while a dealer who does have stock still gets it.

function resolveRoute(step: TourStep, firstVehicleId: string | null) {
  return typeof step.route === "function" ? step.route({ firstVehicleId }) : step.route;
}

function step(id: string): TourStep {
  const found = TOUR_STEPS.find((s) => s.id === id);
  if (!found) throw new Error(`no tour step "${id}"`);
  return found;
}

describe("tour steps that need a vehicle", () => {
  it.each(["vehicle-list-buttons", "vehicle-overview-tabs"])(
    "%s is skipped (route resolves to null) for a dealer with no stock",
    (id) => {
      expect(resolveRoute(step(id), null)).toBeNull();
    }
  );

  it("both are shown for a dealer who has stock, on the right pages", () => {
    expect(resolveRoute(step("vehicle-list-buttons"), "abc")).toBe("/dealer/inventory/list");
    expect(resolveRoute(step("vehicle-overview-tabs"), "abc")).toBe("/dealer/inventory/abc");
  });

  it("the vehicle list itself is still shown with no stock — the page exists, only the row buttons don't", () => {
    expect(resolveRoute(step("vehicle-list"), null)).toBe("/dealer/inventory/list");
  });
});
