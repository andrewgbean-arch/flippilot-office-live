import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LEAD_STATUS_LABELS } from "./leadTypes";

// The Status box on a lead's page used to show the stored words ("viewing booked", "test drive"),
// in lower case, while Add Lead and the Leads list showed them properly capitalised.

describe("lead status wording", () => {
  it("reads the same everywhere, capitalised", () => {
    expect(LEAD_STATUS_LABELS).toEqual({
      new: "New",
      contacted: "Contacted",
      viewing_booked: "Viewing Booked",
      test_drive: "Test Drive",
      negotiating: "Negotiating",
      won: "Won",
      lost: "Lost",
    });
  });

  it("the lead page shows those labels but still saves the stored value", () => {
    const source = readFileSync(join(__dirname, "LeadDetails.tsx"), "utf8");
    expect(source).toContain("{LEAD_STATUS_LABELS[s]}");
    expect(source).toContain("<option key={s} value={s}>");
    expect(source).not.toContain('s.replace("_", " ")');
  });

  it("the Leads list uses the same shared labels", () => {
    const source = readFileSync(join(__dirname, "LeadsDashboard.tsx"), "utf8");
    expect(source).toContain("LEAD_STATUS_LABELS");
  });
});
