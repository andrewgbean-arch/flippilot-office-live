import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ChangeRow, dayHeading, fieldName, fieldValue } from "./ChangeHistoryScreen";
import { canOpenPage } from "@/lib/pageAccess";
import type { ChangeEntry } from "@/lib/changeHistoryApi";
import type { AuthUser } from "@/context/AuthContext";

// The owner's Change History page (the server's changeHistory.ts records it).

const source = (relative: string) => readFileSync(join(__dirname, "..", "..", relative), "utf8");

const entry = (over: Partial<ChangeEntry>): ChangeEntry => ({
  id: 1,
  at: "2030-03-10T14:05:00.000Z",
  actorId: "u2",
  actorName: "Sam Sales",
  actorRole: "sales",
  area: "Stock",
  recordId: "c1",
  recordLabel: "2018 Ford Focus (AB12CDE)",
  action: "changed",
  changes: [],
  ...over,
});

describe("reading the fields", () => {
  it("names stored fields in words", () => {
    expect(fieldName("priceRetail")).toBe("Retail price");
    expect(fieldName("bankAccountNumber")).toBe("Bank account number");
    expect(fieldName("customer_phone")).toBe("Customer phone");
    expect(fieldName("vatRate")).toBe("VAT rate");
  });

  it("shows money in pounds, the VAT rate as a percentage, and yes/no", () => {
    expect(fieldValue("priceRetail", "6500")).toBe("£6,500");
    expect(fieldValue("amount", "12.5")).toBe("£12.50");
    expect(fieldValue("vatRate", "0.2")).toBe("20%");
    expect(fieldValue("vatRate", "0.05")).toBe("5%");
    expect(fieldValue("mileage", "60000")).toBe("60,000 miles");
    expect(fieldValue("year", "2018")).toBe("2018");
    expect(fieldValue("vatIncluded", "true")).toBe("yes");
    expect(fieldValue("notes", undefined)).toBe("nothing");
    expect(fieldValue("bankAccountNumber", "(hidden)")).toBe("(hidden)");
  });

  it("heads each day plainly", () => {
    const now = new Date("2030-03-10T18:00:00");
    expect(dayHeading("2030-03-10T09:00:00", now)).toBe("Today");
    expect(dayHeading("2030-03-09T09:00:00", now)).toBe("Yesterday");
    expect(dayHeading("2030-03-01T09:00:00", now)).toBe("Friday 1 March");
  });
});

describe("a line in the history", () => {
  it("a change: who, what, and before → after", () => {
    const html = renderToStaticMarkup(
      <ChangeRow entry={entry({ changes: [{ field: "priceRetail", before: "6500", after: "5999" }] })} />
    );
    expect(html).toContain("Sam Sales");
    expect(html).toContain("(sales)");
    expect(html).toContain("changed");
    expect(html).toContain("2018 Ford Focus (AB12CDE)");
    expect(html).toMatch(/Retail price:<\/span> <span class="line-through[^"]*">£6,500<\/span> → <span class="text-white">£5,999<\/span>/);
  });

  it("a removal lists what the record held", () => {
    const html = renderToStaticMarkup(
      <ChangeRow entry={entry({ action: "removed", changes: [{ field: "make", before: "Vauxhall" }, { field: "priceRetail", before: "4000" }] })} />
    );
    expect(html).toContain("removed");
    expect(html).toContain("What it held:");
    expect(html).toContain("Make:</span> Vauxhall");
    expect(html).toContain("Retail price:</span> £4,000");
    expect(html).not.toContain("→");
  });

  it("someone joining reads as joining, not as adding themselves", () => {
    const html = renderToStaticMarkup(
      <ChangeRow entry={entry({ area: "Team", action: "added", actorId: "u9", recordId: "u9", actorName: "Morgan Manager", actorRole: "manager", recordLabel: "Morgan Manager", changes: [{ field: "role", after: "manager" }] })} />
    );
    expect(html).toContain("joined the team");
    expect(html).toContain(" as manager");
    expect(html).not.toContain("added");
    // the owner adding someone else is still an addition
    const other = renderToStaticMarkup(<ChangeRow entry={entry({ area: "Team", action: "added", actorId: "u1", recordId: "u9" })} />);
    expect(other).toContain("added");
  });

  it("a note reads as a plain sentence", () => {
    const html = renderToStaticMarkup(
      <ChangeRow
        entry={entry({ action: "note", area: "Customer data", recordLabel: "A customer's details were erased at their request (not kept)", changes: [{ field: "records erased", after: "3" }] })}
      />
    );
    expect(html).not.toMatch(/>changed |>added |>removed /);
    expect(html).toContain("Records erased:</span> 3");
  });
});

describe("who can open it", () => {
  const as = (role: "owner" | "staff", staffRole?: AuthUser["staffRole"]) =>
    ({ id: "u", email: "u@x", name: "U", role, dealershipId: "d", ...(staffRole ? { staffRole } : {}) }) as AuthUser;

  it("the owner only, managers included in the no", () => {
    expect(canOpenPage(as("owner"), "/dealer/change-history")).toBe(true);
    for (const r of ["manager", "sales", "finance", "general"] as const) {
      expect(canOpenPage(as("staff", r), "/dealer/change-history"), r).toBe(false);
    }
  });

  it("is in Settings for the owner, and everyone is told their changes are recorded", () => {
    const settings = source("dealer/settings/Settings.tsx");
    expect(settings).toMatch(/user\?\.role === "owner" && \(\s*<SupernovaGlowCard>\s*<h2[^>]*>Change History<\/h2>/);
    expect(settings).toContain('navigate("/dealer/change-history")');
    expect(settings).toContain("are kept for 90 days, with your");
    expect(source("router/AnimatedRoutes.tsx")).toContain('<Route path="dealer/change-history" element={<ChangeHistoryScreen />} />');
  });
});

describe("the page for anyone else", () => {
  it("says it's the owner's", async () => {
    vi.resetModules();
    vi.doMock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "u", role: "staff", staffRole: "manager", dealershipId: "d" } }) }));
    const { default: Screen } = await import("./ChangeHistoryScreen");
    const html = renderToStaticMarkup(<Screen />);
    expect(html).toContain("Only the dealership owner can see the change history.");
    expect(html).not.toContain("<select");
    vi.doUnmock("@/context/AuthContext");
  });
});
