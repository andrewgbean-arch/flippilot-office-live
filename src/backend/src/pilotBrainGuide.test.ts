import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  APP_MAP,
  RIGHT_SIDEBAR_QUICK_LINKS,
  RIGHT_SIDEBAR_GLANCE,
  appMapPromptSection,
  roadmapPromptSection,
  V8_NOT_BUILT,
} from "./pilotBrainGuide";
import { CONFIDENCE_LEVELS, DEFAULT_REVIEW_DAYS, FIGURE_KINDS } from "./decisionTypes";
import { lookInsidePromptSection, lookInsideToolDefinition, tabsFor } from "./pilotBrainTabs";

// The tests below read the REAL sidebar files, so the map Pilot Brain gives
// Boss can't quietly fall out of step with what Boss actually sees.
const COMPONENTS = path.join(__dirname, "..", "..", "components");
const read = (file: string) => fs.readFileSync(path.join(COMPONENTS, file), "utf8").replace(/\r/g, "");

// section headings are `label: "..."` at the section indent; links are
// `{ to: "...", label: "..." }`
function parseLeftSidebar() {
  const src = read("DealerSidebar.tsx");
  const marks: { at: number; kind: "section" | "item"; label: string }[] = [];
  for (const m of src.matchAll(/\n\s{6}label: "([^"]+)"/g)) marks.push({ at: m.index!, kind: "section", label: m[1]! });
  for (const m of src.matchAll(/\{ to: "[^"]+", label: "([^"]+)" \}/g)) marks.push({ at: m.index!, kind: "item", label: m[1]! });
  marks.sort((a, b) => a.at - b.at);
  const sections: { section: string; items: string[] }[] = [];
  for (const mark of marks) {
    if (mark.kind === "section") sections.push({ section: mark.label, items: [] });
    else sections[sections.length - 1]?.items.push(mark.label);
  }
  // Links that only appear for FlipPilot's own support staff
  return sections.map(s => ({ ...s, items: s.items.filter(i => !i.endsWith("(Admin)")) }));
}

describe("the app map matches the real sidebars", () => {
  it("has every left-sidebar section and link, in order, and nothing that isn't there", () => {
    const real = parseLeftSidebar();
    expect(real.length).toBeGreaterThan(15); // the parser really found the sidebar
    expect(APP_MAP).toEqual(real);
  });

  it("has the right sidebar's quick links and at-a-glance figures", () => {
    const src = read("DealerRightSidebar.tsx");
    const quick = [...src.matchAll(/label: "([^"]+)", icon/g)].map(m => m[1]);
    expect(quick.length).toBeGreaterThan(3);
    expect(RIGHT_SIDEBAR_QUICK_LINKS).toEqual(quick);
    for (const label of RIGHT_SIDEBAR_GLANCE) expect(src).toContain(label);
  });

  it("never lists the support-admin links, which no dealer ever sees", () => {
    const text = appMapPromptSection();
    expect(text).not.toContain("(Admin)");
    expect(text).not.toContain("Support Inbox");
  });
});

describe("appMapPromptSection", () => {
  const text = appMapPromptSection();

  it("names each section with its links, exactly as written on screen", () => {
    expect(text).toContain("Pilot Brain: Talk to Pilot Brain, Operations (Approvals), Strategy (Goals & Briefing)");
    expect(text).toContain("Sales: Sales Hub, Add Lead, Leads Dashboard, Sales Pipeline, Viewing & Test Drive Requests");
    expect(text).toContain("Bookkeeping: Bookkeeping Hub");
  });

  it("covers the right sidebar too", () => {
    expect(text).toContain("Add Vehicle, Add Lead, Vehicle List, Jobs Board, My Rota, Consumables, Search");
    expect(text).toContain("Open Jobs, Pending Bookings, MOT Attention");
  });

  it("tells her not to invent screens, and that knowing where a screen is doesn't open its contents", () => {
    expect(text).toContain("never invent a screen or menu that isn't here");
    expect(text).toContain("the customer database, wages, private messages and pictures stay off-limits");
  });
});

describe("roadmapPromptSection", () => {
  const text = roadmapPromptSection();

  // The parts of the text, so a wording check can't be satisfied by the wrong sentence.
  const built = text.slice(text.indexOf("BUILT:"), text.indexOf("NOT BUILT YET"));
  const notBuilt = text.slice(text.indexOf("NOT BUILT YET"), text.indexOf("HOW TO TALK ABOUT IT"));

  it("says V1-V7 are built and V8 is only PARTLY built: it no longer calls the whole of V8 planned", () => {
    expect(text).toContain("YOUR ROADMAP");
    expect(text).toContain("V1-V7 above are built and live");
    expect(text).toContain("V8");
    expect(text).toContain("Digital Twin");
    expect(text).toContain("PARTLY BUILT");
    // the old, now false, wording
    expect(text).not.toContain("PLANNED and NOT BUILT");
    expect(text).not.toContain("None of the three exists yet");
    expect(text).not.toContain("never claim to keep a decision journal");
    expect(text).not.toContain("is planned and not built");
  });

  it("names exactly what is built: a Decision Journal, a Devil's Advocate and a first Simulator", () => {
    expect(built).toContain("Decision Journal");
    expect(built).toContain("your recommendation");
    expect(built).toContain("the Devil's Advocate challenge");
    expect(built).toContain("what Boss chose and why");
    expect(built).toContain("what he expected");
    expect(built).toContain(`about ${DEFAULT_REVIEW_DAYS} days later what actually happened and the lesson`);
    expect(built).toContain("A Devil's Advocate (\"Challenge me\")");
    expect(built).toContain("the case for, the case against, the assumptions, the unknowns, the downside, an alternative and your view");
    expect(built).toContain("A first Simulator");
    expect(built).toContain("the dealership's own recent history");
  });

  it("says the Simulator does two kinds of decision only: adding stock and cutting the price of ageing stock", () => {
    expect(built).toContain("two kinds of decision only, adding stock and cutting the price of ageing stock");
    expect(built).toContain("prints every assumption next to its answer");
  });

  it("puts all of it on the Decisions page under Pilot Brain, for owners and managers only", () => {
    expect(text).toContain("all on the Decisions page under Pilot Brain, for owners and managers only");
    expect(text).toContain("tell them it is for owners and managers only");
  });

  it("names exactly what is NOT built, so she says so plainly", () => {
    expect(V8_NOT_BUILT).toEqual([
      "a capital, cash or preparation-capacity model",
      "market-driven simulation",
      "branch or hiring scenarios",
      "learning dashboards beyond simple counts",
      "any autonomy",
    ]);
    expect(notBuilt).toContain("you must say so plainly if Boss asks for any of it");
    expect(notBuilt).toContain(V8_NOT_BUILT.join(", "));
    expect(notBuilt).toContain("Do not describe any V8 feature that is not listed as built above");
    expect(notBuilt).toContain("never say a built one can do more than it does");
  });

  it("never lists as built anything it lists as not built", () => {
    for (const missing of V8_NOT_BUILT) {
      expect(built, missing).not.toContain(missing);
      expect(built.toLowerCase(), missing).not.toContain("autonom");
    }
    for (const word of ["hiring", "branch", "market-driven", "dashboard"]) expect(built.toLowerCase(), word).not.toContain(word);
  });

  it("marks every figure known, inferred, predicted or unknown and confidence low, medium or high: the contract's own words", () => {
    for (const kind of FIGURE_KINDS) expect(built, kind).toContain(kind);
    expect(built).toContain("known, inferred, predicted or unknown");
    expect(built).toContain("an unknown figure is shown as Unknown, never guessed and never as 0");
    expect(CONFIDENCE_LEVELS).toEqual(["low", "medium", "high"]);
    expect(text).toContain(`${CONFIDENCE_LEVELS.slice(0, -1).join(", ")} or ${CONFIDENCE_LEVELS.at(-1)}`);
    expect(built).toContain("confidence as low, medium or high with reasons");
  });

  it("has no percentage-confidence language anywhere: confidence is a word, never a number", () => {
    expect(text).not.toMatch(/\d\s*%/);
    expect(text).not.toMatch(/\d+\s*(percent|per cent)\b/i);
    expect(text).not.toMatch(/probabilit|likelihood|chance of|% (confident|confidence|sure)/i);
    expect(text).toContain("Confidence is only ever the word low, medium or high, never a percentage");
    expect(text).not.toContain("made-up percentage"); // the old wording
  });

  it("keeps the standing rules: a simulation is not a forecast, she recommends and Boss decides, and she writes nothing", () => {
    expect(text).toContain("a simulation is arithmetic on the dealership's own history plus the assumptions printed next to the answer");
    expect(text).toContain("\"a simulation, not a forecast\"");
    expect(text).toContain("never present its answer as a prediction");
    expect(text).toContain("You recommend, challenge and simulate; Boss decides");
    expect(text).toContain("You cannot create, change, decide or review anything in the journal yourself");
    expect(text).toContain("nothing there changes a car, a lead, a price or the books");
    expect(text).toContain("evidence, not dates");
    expect(text).toContain("Whatever you become, Boss decides");
  });

  it("tells her the journal is only as good as what has been reviewed, so she never draws a pattern from one or two", () => {
    expect(text).toContain("it holds real outcomes only for decisions Boss has recorded and reviewed");
    expect(text).toContain("never draw a pattern from one or two");
  });

  it("does not describe her tools: it never names one, so the words can't be quoted back", () => {
    for (const name of ["look_inside", "prepare_edit", "tool_use", "tool_result"]) expect(text).not.toContain(name);
  });
});

describe("the roadmap and the look-inside tabs tell the same story", () => {
  const text = roadmapPromptSection();
  const asker = (role: "owner" | "staff", staffRole?: "manager" | "finance" | "sales" | "general") =>
    ({ id: "u", email: "u@example.test", name: "Asker", role, dealershipId: "d", ...(staffRole ? { staffRole } : {}) }) as never;

  it("says the journal is for owners and managers, and the tab is offered to exactly those people", () => {
    expect(text).toContain("owners and managers only");
    expect(tabsFor(asker("owner"))).toContain("decisions");
    expect(tabsFor(asker("staff", "manager"))).toContain("decisions");
    for (const role of ["finance", "sales", "general"] as const) expect(tabsFor(asker("staff", role))).not.toContain("decisions");
  });

  it("says she can't write the journal, and the tools she is given can't", () => {
    expect(text).toContain("You cannot create, change, decide or review anything in the journal yourself");
    const def = lookInsideToolDefinition(asker("owner"));
    expect(def.name).toBe("look_inside");
    expect(def.description).toContain("Read-only");
    expect(lookInsidePromptSection(asker("owner"))).toContain("you cannot create, change, decide or review anything in it");
  });

  it("does not promise her a tab she never opens: the customer database, diary, messages, pay and billing stay closed", () => {
    for (const closed of ["customers", "diary", "messages", "timekeeping", "leave", "staff", "billing"]) {
      expect(tabsFor(asker("owner")), closed).not.toContain(closed);
    }
    expect(text).not.toMatch(/customer database|wages|private messages/i);
  });
});
