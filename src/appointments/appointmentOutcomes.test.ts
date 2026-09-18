import { describe, it, expect } from "vitest";
import { outcomeOptionsFor } from "./appointmentOutcomes";

// Mirrors the backend rule (PUT /appointments/:id rejects "purchased" on
// an MOT booking) so the screen never offers a button that can only fail.
describe("outcomeOptionsFor", () => {
  it("offers showed, bought and no-show for a viewing or test drive", () => {
    for (const type of ["viewing", "test_drive"] as const) {
      expect(outcomeOptionsFor(type).map((o) => o.value)).toEqual(["showed", "purchased", "no_show"]);
    }
  });

  it("never offers 'bought' for an MOT booking — it's the customer's own car", () => {
    expect(outcomeOptionsFor("mot").map((o) => o.value)).toEqual(["showed", "no_show"]);
  });
});
