import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  APP_MAP,
  RIGHT_SIDEBAR_QUICK_LINKS,
  RIGHT_SIDEBAR_GLANCE,
  appMapPromptSection,
  roadmapPromptSection,
} from "./pilotBrainGuide";

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

  it("tells her V8 exists as a plan and names its three parts", () => {
    expect(text).toContain("V8");
    expect(text).toContain("Digital Twin");
    expect(text).toContain("Simulator");
    expect(text).toContain("Devil's Advocate");
    expect(text).toContain("Decision Journal");
  });

  it("is explicit that none of it is built, so she can't pretend to simulate or keep a journal", () => {
    expect(text).toContain("PLANNED and NOT BUILT");
    expect(text).toContain("None of the three exists yet");
    expect(text).toContain("Never present a projection as a simulation result");
    expect(text).toContain("never claim to keep a decision journal");
  });

  it("keeps the standing rules: honest confidence, evidence not dates, Boss decides", () => {
    expect(text).toContain("never a made-up percentage");
    expect(text).toContain("evidence, not dates");
    expect(text).toContain("Boss decides");
  });
});
