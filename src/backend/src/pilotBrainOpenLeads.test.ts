import crypto from "node:crypto";
import { describe, it, expect } from "vitest";
import { writeTenantCollection } from "./db";
import { buildBusinessSummary } from "./routes/pilotBrain";

// The Brain's "Open leads" headline used to count website MOT bookings as open
// leads, while the lead-source block and the Watcher (correctly) leave them out:
// an MOT booking is the customer's own car and can never become a sale. So the
// same summary said "Open leads: 6" and then "4 still open, 2 MOT bookings left
// out". These pin the headline to the same rule as the rest.
describe("Pilot Brain's Open leads headline", () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const lead = (status: string, n = 3) => ({ id: crypto.randomUUID(), status, source: "AutoTrader", createdAt: daysAgo(n) });

  function summaryFor(leads: unknown[]): string {
    const dealershipId = `open-leads-test-${crypto.randomUUID()}`;
    writeTenantCollection(dealershipId, "vehicles", []);
    writeTenantCollection(dealershipId, "leads", leads);
    return buildBusinessSummary(dealershipId, true);
  }

  it("does not count website MOT bookings as open leads", () => {
    const summary = summaryFor([
      lead("new"), lead("contacted"), lead("negotiating"),
      lead("won"), lead("lost"),
      lead("mot_booked"), lead("mot_booked"),
    ]);
    expect(summary).toContain("Open leads: 3\n");
  });

  it("reads the status without caring about case or stray spaces, like the lead-source block", () => {
    const summary = summaryFor([lead("new"), lead(" MOT_Booked "), lead("Won "), lead("LOST")]);
    expect(summary).toContain("Open leads: 1\n");
  });

  it("agrees with the lead-source block about the same leads", () => {
    const summary = summaryFor([lead("new"), lead("contacted"), lead("mot_booked"), lead("mot_booked")]);
    expect(summary).toContain("Open leads: 2\n");
    expect(summary).toContain("2 website MOT bookings in that window are left out");
    expect(summary).toContain("2 still open"); // the same two leads, counted the same way
  });

  it("still counts every genuinely open stage", () => {
    const summary = summaryFor(["new", "contacted", "viewing_booked", "test_drive", "negotiating"].map(s => lead(s)));
    expect(summary).toContain("Open leads: 5\n");
  });
});
