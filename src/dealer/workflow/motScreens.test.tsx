import { describe, it, expect, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const state = vi.hoisted(() => ({ vehicles: [] as any[] }));
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({ vehicles: state.vehicles }),
}));

import MOTWorkflow from "./MOTWorkflow";
import MOTWorkflowPortfolio from "./MOTWorkflowPortfolio";
import MOTTimeline from "@/features/dealer-ai/mot/MOTTimeline";
import MOTHealthScore from "@/components/motors/MOTHealthScore";
import MOTInsightsPanel from "@/components/motors/MOTInsightsPanel";
import { toMileageEntries } from "@/components/motors/MOTMileageHistory";
import MOTStatusCard, { motStatusLabel } from "@/components/motors/MOTStatusCard";
import MotAiPassChance from "@/components/motors/MotAiPassChance";
import MotAiVerdictCard from "@/components/motors/MotAiVerdictCard";
import { motAiEngine } from "@/engines/motAiEngine";

// Every screen that shows MOT information. The old ones printed a confident
// "Health Score 96%" and "Pass Probability 97%" for a car with no MOT data,
// "Advisories: 0 / Failures: 0" as if it had a clean record, and a blank where
// the expiry date should be. These tests read the rendered text.

const DAY = 86400000;
const future = new Date(Date.now() + 200 * DAY).toISOString().slice(0, 10);
const past = new Date(Date.now() - 20 * DAY).toISOString().slice(0, 10);
const soon = new Date(Date.now() + 10 * DAY).toISOString().slice(0, 10);

const blankMot = () => ({ expiry: "", advisories: [], historyScore: 0, history: [] as any[], mileage: null });

function car(over: Record<string, any> = {}): any {
  return {
    id: "v1",
    make: "Ford",
    model: "Fiesta",
    reg: "AB12CDE",
    mileage: 80000,
    status: "in-stock",
    mot: blankMot(),
    ...over,
  };
}

// DVSA order: newest first. The engine and screens must not rely on it.
const richHistory = [
  { date: "2025-10-02T10:00:00.000Z", result: "PASS", mileage: 120000, failures: [], advisories: ["Tyre worn"], testNumber: "111" },
  { date: "2025-09-28T10:00:00.000Z", result: "FAIL", mileage: 119900, failures: ["Brake pad", "Headlamp aim", "Wiper blade"], advisories: [], testNumber: "110" },
  { date: "2024-10-01T10:00:00.000Z", result: "FAIL", mileage: 108000, failures: ["Exhaust", "Tyre"], advisories: [], testNumber: "109" },
  { date: "2023-10-01T10:00:00.000Z", result: "PASS", mileage: 96000, failures: [], advisories: [], testNumber: "108" },
];

function renderAt(path: string, routePath: string, element: ReactElement): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
      </Routes>
    </MemoryRouter>
  );
}

// No text like "NaN", "undefined", "null%", "Infinity" may ever reach a dealer.
function expectNoJunk(html: string) {
  expect(html).not.toMatch(/NaN|undefined|null%|null\/100|Infinity/);
}

const theme = { card: "#000", accent: "#fff", text: "#ccc", goldSoftGlow: "#fff", goldDeep: "#fff", blackSoft: "#000" };

describe("MOT cards with no MOT data", () => {
  const empty = blankMot();

  it("the score card says 'No MOT data' and shows no number", () => {
    const html = renderToStaticMarkup(<MOTHealthScore mot={empty} />);
    expect(html).toContain("No MOT data");
    expect(html).not.toMatch(/\d+\/100/);
    expect(html).not.toContain("healthy");
    expectNoJunk(html);
  });

  it("the pass card says 'No MOT data', not a percentage", () => {
    const html = renderToStaticMarkup(<MotAiPassChance ai={motAiEngine(empty, [])} theme={theme} />);
    expect(html).toContain("No MOT data");
    expect(html).not.toMatch(/\d+%/);
    expectNoJunk(html);
  });

  it("the summary card says no MOT data is recorded", () => {
    const html = renderToStaticMarkup(<MotAiVerdictCard ai={motAiEngine(empty, [])} theme={theme} />);
    expect(html).toContain("No MOT data is recorded");
    expect(html).not.toContain("healthy");
  });

  it("the insights panel does not print Advisories: 0 and Failures: 0 for a never-checked car", () => {
    const html = renderToStaticMarkup(<MOTInsightsPanel mot={empty} />);
    expect(html).toContain("No MOT data recorded");
    expect(html).not.toContain("Advisories: 0");
    expect(html).not.toContain("Failures: 0");
    expect(html).not.toContain("Unknown");
  });

  it("the status card does not print a blank expiry or a bare 'Unknown'", () => {
    const html = renderToStaticMarkup(<MOTStatusCard status="Unknown" expiryDate="" theme={theme} />);
    expect(html).toContain("No MOT date recorded");
    expect(html).toContain("No expiry date recorded");
  });
});

describe("MOT cards with a real record", () => {
  const mot = { expiry: future, advisories: ["Tyre worn"], historyScore: 0, history: richHistory, mileage: 120000 };

  it("the score card shows a score, what it was worked out from, and the rule", () => {
    const html = renderToStaticMarkup(<MOTHealthScore mot={mot} />);
    expect(html).toMatch(/\d+\/100/);
    expect(html).toContain("5 failure items on record, 2 failed tests of 4");
    expect(html).toContain("120,000 miles"); // the NEWEST test's mileage, not the oldest (96,000)
    expect(html.toLowerCase()).toContain("not a prediction");
    expect(html).not.toContain("AI");
    expectNoJunk(html);
  });

  it("the pass card shows a band and calls it a rough guide, never a percentage", () => {
    const html = renderToStaticMarkup(<MotAiPassChance ai={motAiEngine(mot, mot.history)} theme={theme} />);
    expect(html).toMatch(/Good|Fair|Poor/);
    expect(html).toContain("rough guide");
    expect(html).not.toMatch(/\d+%/);
  });

  it("an expired MOT says 'MOT expired' rather than a score", () => {
    const html = renderToStaticMarkup(<MOTHealthScore mot={{ ...mot, expiry: past }} />);
    expect(html).toContain("MOT expired");
    expect(html).not.toMatch(/\d+\/100/);
  });

  it("the insights panel formats the expiry as a date and counts failures from the history", () => {
    const html = renderToStaticMarkup(<MOTInsightsPanel mot={mot} />);
    expect(html).toMatch(/Expiry: \d{1,2} \w{3} \d{4}/);
    expect(html).toContain("Failures: 5");
  });

  it("shows a Status row only when the caller worked one out (the vehicle record never stores it)", () => {
    expect(renderToStaticMarkup(<MOTInsightsPanel mot={mot} />)).not.toContain("Status:");
    expect(renderToStaticMarkup(<MOTInsightsPanel mot={{ ...mot, motStatus: "Valid" }} />)).toContain("Status: Valid");
  });
});

describe("MOT Workflow screen (vehicle MOT tab)", () => {
  const render = (v: any) => {
    state.vehicles = [v];
    return renderAt("/dealer/workflow/mot/v1", "/dealer/workflow/mot/:id", <MOTWorkflow />);
  };

  it("a car with no MOT data says so: no health score, no pass probability, no zero counts", () => {
    const html = render(car());
    expect(html).toContain("No MOT data is recorded for this vehicle");
    expect(html).toContain("Not recorded"); // the expiry, instead of a blank
    expect(html).toContain("No MOT data, so nothing to check");
    expect(html).not.toContain("Health Score");
    expect(html).not.toContain("Pass Probability");
    expect(html).not.toContain("Mileage Risk");
    expect(html).not.toContain("Advisories: 0");
    expect(html).not.toContain("No advisories recorded");
    expectNoJunk(html);
  });

  it("a car with recorded failures shows them next to a low, labelled score (the old page said 96%)", () => {
    const html = render(car({ mot: { expiry: future, advisories: ["Tyre worn"], historyScore: 0, history: richHistory, mileage: 120000 } }));
    expect(html).toContain("Failed tests on record: 2");
    expect(html).toContain("failure items listed: 5");
    expect(html).toContain("Rule-of-thumb score");
    expect(html).not.toContain("Pass Probability");
    expect(html).toContain("Next MOT: rough outlook");
    expect(html).toContain("rough guide");
    // The latest test is the newest by date (PASS on 2 Oct 2025), whatever the stored order.
    expect(html).toContain("PASS on 2 Oct 2025, 120,000 miles");
    expectNoJunk(html);
  });

  it("gives the same latest test when the history is stored oldest first", () => {
    const html = render(car({ mot: { expiry: future, advisories: [], historyScore: 0, history: [...richHistory].reverse(), mileage: 120000 } }));
    expect(html).toContain("PASS on 2 Oct 2025, 120,000 miles");
  });

  it("an expired MOT is called expired and shows no score", () => {
    const html = render(car({ mot: { expiry: past, advisories: [], historyScore: 0, history: richHistory, mileage: 120000 } }));
    expect(html).toContain("MOT expired");
    expect(html).not.toContain("Rule-of-thumb score");
  });
});

describe("MOT Workflow portfolio", () => {
  const render = (vehicles: any[]) => {
    state.vehicles = vehicles;
    return renderToStaticMarkup(<MemoryRouter><MOTWorkflowPortfolio /></MemoryRouter>);
  };

  it("names the most urgent car and lists the soonest expiry first", () => {
    const html = render([
      car({ id: "a", make: "Vauxhall", model: "Astra", reg: "ZZ99ZZZ", mot: { expiry: soon, advisories: [], history: [] } }),
      car({ id: "b", make: "Ford", model: "Focus", reg: "AA11AAA", mot: { expiry: past, advisories: [], history: [] } }),
    ]);
    expect(html).toContain("Showing Ford Focus (AA11AAA)");
    expect(html.indexOf("Ford Focus (AA11AAA)")).toBeLessThan(html.indexOf("Vauxhall Astra (ZZ99ZZZ)"));
    expect(html).toContain("MOT expired");
    expectNoJunk(html);
  });

  it("leaves sold cars out", () => {
    const html = render([
      car({ id: "a", make: "Vauxhall", model: "Astra", status: "sold", mot: { expiry: past, advisories: [], history: [] } }),
    ]);
    expect(html).not.toContain("Vauxhall Astra");
    expect(html).toContain("No vehicle in stock has an MOT that is expired or due within 30 days");
  });

  it("lists cars with no MOT record separately instead of treating them as fine", () => {
    const html = render([
      car({ id: "a", make: "Mini", model: "Cooper", reg: "MM11MMM", mot: blankMot() }),
      car({ id: "b", make: "Kia", model: "Rio", reg: "KK22KKK", mot: { expiry: future, advisories: [], history: [] } }),
    ]);
    expect(html).toContain("No MOT data recorded");
    expect(html).toContain("Mini Cooper (MM11MMM)");
    expect(html).not.toContain("Kia Rio");
  });
});

describe("MOT Timeline screen", () => {
  const render = (v: any) => {
    state.vehicles = [v];
    return renderAt("/dealer-ai/mot/v1", "/dealer-ai/mot/:id", <MOTTimeline />);
  };

  it("with no history there is no made-up risk score, only 'no history'", () => {
    const html = render(car());
    expect(html).toContain("No MOT history recorded for this vehicle");
    expect(html).toContain("No MOT date");
    expect(html).not.toContain("Risk Score");
    expect(html).not.toContain("50/100");
    expectNoJunk(html);
  });

  it("shows failed tests as a count and the newest test's mileage, newest test first", () => {
    const html = render(car({ mot: { expiry: future, advisories: [], historyScore: 0, history: [...richHistory].reverse(), mileage: 1 } }));
    expect(html).toContain("Failed Tests");
    expect(html).not.toContain("Risk Score");
    expect(html).toContain("120,000"); // last mileage from the newest test, not mot.mileage (1) or the oldest test
    expect(html.indexOf("2 Oct 2025")).toBeLessThan(html.indexOf("1 Oct 2023"));
  });
});

describe("MOT Lookup helpers", () => {
  it("lists only tests that recorded a mileage, with the real reading (never 0 or the current mileage)", () => {
    const entries = toMileageEntries([
      { date: "2025-01-01", mileage: 50000 },
      { date: "2024-01-01", mileage: null },
      { date: "2023-01-01" },
      { year: 2022, mileage: 30000 },
    ]);
    expect(entries).toEqual([
      { date: "2025-01-01", year: undefined, mileage: 50000 },
      { date: undefined, year: 2022, mileage: 30000 },
    ]);
    expect(toMileageEntries(undefined)).toEqual([]);
  });

  it("labels the MOT status with the same rule as the vehicle list, valid through the expiry day", () => {
    const noon = new Date(Date.UTC(2026, 8, 20, 12, 0, 0));
    expect(motStatusLabel("2026-09-19", noon)).toBe("Expired");
    expect(motStatusLabel("2026-09-20", noon)).toBe("Expiring Soon"); // today is still valid
    expect(motStatusLabel("2026-10-15", noon)).toBe("Expiring Soon");
    expect(motStatusLabel("2027-03-01", noon)).toBe("Valid");
    expect(motStatusLabel("", noon)).toBe("Unknown");
    expect(motStatusLabel(undefined, noon)).toBe("Unknown");
    expect(motStatusLabel("garbage", noon)).toBe("Unknown");
  });
});
