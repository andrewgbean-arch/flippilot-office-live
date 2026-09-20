import { describe, it, expect } from "vitest";
import type { Lead, LeadStatus } from "@/dealer/leads/leadTypes";
import { leadAgeDays, NO_SOURCE_LABEL, OLDEST_SHOWN, summariseLeads } from "./leadSummary";

const NOW = new Date("2026-09-20T12:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

let nextId = 0;
function lead(over: { name?: string; status?: string; source?: string; createdAt?: string } = {}): Lead {
  return {
    id: `lead-${++nextId}`,
    name: over.name ?? "A Buyer",
    source: over.source ?? "AutoTrader",
    status: (over.status ?? "new") as LeadStatus,
    createdAt: over.createdAt ?? daysAgo(1),
  };
}

describe("summariseLeads: totals and stages", () => {
  it("is all zeros for no leads, with every stage still listed", () => {
    const s = summariseLeads([], NOW);
    expect(s).toMatchObject({ total: 0, open: 0, won: 0, lost: 0, bySource: [], oldestOpen: [] });
    expect(s.byStatus.map(x => x.count)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(s.byStatus.map(x => x.label)).toEqual([
      "New",
      "Contacted",
      "Viewing Booked",
      "Test Drive",
      "Negotiating",
      "Won",
      "Lost",
    ]);
    expect(s.openByAge.map(b => b.count)).toEqual([0, 0, 0, 0]);
  });

  it("counts leads by stage, and treats everything that is neither won nor lost as open", () => {
    const s = summariseLeads(
      [
        lead({ status: "new" }),
        lead({ status: "new" }),
        lead({ status: "contacted" }),
        lead({ status: "negotiating" }),
        lead({ status: "won" }),
        lead({ status: "won" }),
        lead({ status: "lost" }),
      ],
      NOW
    );
    expect(s.total).toBe(7);
    expect(s.open).toBe(4);
    expect(s.won).toBe(2);
    expect(s.lost).toBe(1);
    expect(s.byStatus.find(x => x.status === "new")?.count).toBe(2);
    expect(s.byStatus.find(x => x.status === "won")?.count).toBe(2);
  });

  it("keeps a lead with a status it doesn't know as open, under 'Other', rather than dropping it", () => {
    const s = summariseLeads([lead({ status: "callback" }), lead({ status: "new" })], NOW);
    expect(s.total).toBe(2);
    expect(s.open).toBe(2);
    expect(s.byStatus.at(-1)).toEqual({ status: "other", label: "Other", count: 1 });
    expect(s.oldestOpen.find(r => r.statusLabel === "Other")).toBeDefined();
  });

  it("reports no invented percentages or chances", () => {
    expect(Object.keys(summariseLeads([lead()], NOW)).sort()).toEqual(
      ["bySource", "byStatus", "lost", "oldestOpen", "open", "openByAge", "total", "won"].sort()
    );
  });
});

describe("summariseLeads: sources", () => {
  it("counts leads and won leads per source, biggest first, ignoring case and stray spaces", () => {
    const s = summariseLeads(
      [
        lead({ source: "AutoTrader", status: "won" }),
        lead({ source: "autotrader ", status: "new" }),
        lead({ source: "AutoTrader", status: "lost" }),
        lead({ source: "Walk-in", status: "won" }),
        lead({ source: "Facebook", status: "new" }),
        lead({ source: "Facebook", status: "new" }),
      ],
      NOW
    );
    expect(s.bySource).toEqual([
      { source: "AutoTrader", total: 3, won: 1 },
      { source: "Facebook", total: 2, won: 0 },
      { source: "Walk-in", total: 1, won: 1 },
    ]);
  });

  it("files a blank source under 'Source not recorded' instead of 'Unknown' or dropping it", () => {
    const s = summariseLeads([lead({ source: "" }), lead({ source: "   " })], NOW);
    expect(s.bySource).toEqual([{ source: NO_SOURCE_LABEL, total: 2, won: 0 }]);
  });

  it("breaks ties between equal sources alphabetically", () => {
    const s = summariseLeads([lead({ source: "Zed" }), lead({ source: "Alpha" })], NOW);
    expect(s.bySource.map(x => x.source)).toEqual(["Alpha", "Zed"]);
  });
});

describe("summariseLeads: open leads by age", () => {
  it("buckets open leads by whole days since they were added, and leaves won and lost out", () => {
    const s = summariseLeads(
      [
        lead({ createdAt: daysAgo(0) }),
        lead({ createdAt: daysAgo(6) }), // still the last 7 days
        lead({ createdAt: daysAgo(7) }),
        lead({ createdAt: daysAgo(29) }),
        lead({ createdAt: daysAgo(30) }),
        lead({ createdAt: daysAgo(200) }),
        lead({ createdAt: "garbage" }),
        lead({ status: "won", createdAt: daysAgo(500) }),
        lead({ status: "lost", createdAt: daysAgo(500) }),
      ],
      NOW
    );
    expect(s.openByAge).toEqual([
      { key: "week", label: "Added in the last 7 days", count: 2 },
      { key: "month", label: "Added 7 to 29 days ago", count: 2 },
      { key: "older", label: "Added 30 or more days ago", count: 2 },
      { key: "unknown", label: "No date recorded", count: 1 },
    ]);
  });

  it("names the open leads that have waited longest, oldest first, with any undated lead last", () => {
    const s = summariseLeads(
      [
        lead({ name: "Recent", createdAt: daysAgo(2) }),
        lead({ name: "Undated", createdAt: "garbage" }),
        lead({ name: "Oldest", createdAt: daysAgo(90), status: "contacted" }),
        lead({ name: "Middle", createdAt: daysAgo(30) }),
        lead({ name: "Closed", createdAt: daysAgo(999), status: "won" }),
      ],
      NOW
    );
    expect(s.oldestOpen.map(r => r.name)).toEqual(["Oldest", "Middle", "Recent", "Undated"]);
    expect(s.oldestOpen[0]).toMatchObject({ days: 90, statusLabel: "Contacted" });
    expect(s.oldestOpen[3]?.days).toBeNull();
  });

  it("shows at most OLDEST_SHOWN leads, and names a lead with no name", () => {
    const many = Array.from({ length: OLDEST_SHOWN + 5 }, (_, i) => lead({ name: i === 0 ? "  " : `L${i}`, createdAt: daysAgo(100 - i) }));
    const s = summariseLeads(many, NOW);
    expect(s.oldestOpen).toHaveLength(OLDEST_SHOWN);
    expect(s.oldestOpen[0]?.name).toBe("Unnamed lead");
  });
});

describe("leadAgeDays", () => {
  it("is whole days, never negative, and null for a date that can't be read", () => {
    expect(leadAgeDays(daysAgo(3), NOW)).toBe(3);
    expect(leadAgeDays(new Date(NOW.getTime() + 5 * 86_400_000).toISOString(), NOW)).toBe(0);
    expect(leadAgeDays("nope", NOW)).toBeNull();
    expect(leadAgeDays(undefined, NOW)).toBeNull();
    expect(leadAgeDays("", NOW)).toBeNull();
  });
});
