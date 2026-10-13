import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canSeeLeadFinances } from "@/lib/permissions";
import type { AuthUser } from "@/context/AuthContext";

const who = (role: string, staffRole?: string) => ({ id: "u", role, staffRole }) as unknown as AuthUser;

describe("who sees a lead's buyer finances", () => {
  it("is everyone but a general account", () => {
    expect(canSeeLeadFinances(who("owner"))).toBe(true);
    for (const r of ["manager", "sales", "finance"]) expect(canSeeLeadFinances(who("staff", r))).toBe(true);
    expect(canSeeLeadFinances(who("staff", "general"))).toBe(false);
    expect(canSeeLeadFinances(who("staff"))).toBe(false);
    expect(canSeeLeadFinances(null)).toBe(false);
  });

  it("the lead page keeps the whole Affordability Check behind it", () => {
    const source = readFileSync(join(__dirname, "LeadDetails.tsx"), "utf8");
    const gate = source.indexOf("{canSeeLeadFinances(user) && (");
    expect(gate).toBeGreaterThan(-1);
    for (const heading of ["Affordability Check", "leaddetails-monthly-income", "leaddetails-savings", "<AffordabilitySummaryCard"]) {
      expect(source.indexOf(heading)).toBeGreaterThan(gate);
    }
  });
});
