import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AuthUser } from "@/context/AuthContext";
import { TOUR_CHAPTERS } from "./tourSteps";
import { chaptersFor, nextChapterStart, placeInChapter, planFor, stepRoute, type TourStep } from "./tourPlan";

const owner = { id: "o", email: "o@x", name: "O", role: "owner", dealershipId: "d" } as AuthUser;
const as = (staffRole: AuthUser["staffRole"]) => ({ ...owner, role: "staff", staffRole }) as AuthUser;
const allSteps = TOUR_CHAPTERS.flatMap(c => c.steps);
const step = (id: string): TourStep => {
  const found = allSteps.find(s => s.id === id);
  if (!found) throw new Error(`no tour step "${id}"`);
  return found;
};

// Every .tsx file under src, read once.
function sources(dir = join(process.cwd(), "src")): string {
  let text = "";
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "backend" && name !== "node_modules") text += sources(path);
    } else if (name.endsWith(".tsx") && !name.includes(".test.")) text += readFileSync(path, "utf8");
  }
  return text;
}

describe("the tour script", () => {
  it("gives every step its own id (it is also the name of its recording)", () => {
    const ids = allSteps.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("points only at things that really are in the app", () => {
    const src = sources();
    for (const s of allSteps) {
      if (!s.target || s.target.startsWith("css:")) continue;
      // written as data-tour="…", or handed to a component that sets it (tourId="…")
      expect(src.includes(`"${s.target}"`), `${s.id}: "${s.target}" is on no page`).toBe(true);
    }
  });

  it("keeps each line short enough to listen to", () => {
    for (const s of allSteps) expect(s.narration.split(/\s+/).length, s.id).toBeLessThanOrEqual(75);
  });

  it("covers every page in the menu", () => {
    const menu = readFileSync(join(process.cwd(), "src", "components", "DealerSidebar.tsx"), "utf8");
    const menuPages = [...menu.matchAll(/\{ to: "(\/[^"]*)", label:/g)].map(m => m[1]!).filter(p => !p.startsWith("/admin"));
    const toured = new Set(allSteps.map(s => (typeof s.route === "string" ? s.route : s.route({ firstVehicleId: "car" }))));
    for (const page of menuPages) expect(toured.has(page), `${page} is in the menu but not in the tour`).toBe(true);
  });
});

describe("who gets which steps", () => {
  it("skips a car's steps for a dealer with no stock yet, and keeps them otherwise", () => {
    expect(stepRoute(step("car-page"), null, owner)).toBeNull();
    expect(stepRoute(step("vehicle-row"), null, owner)).toBeNull();
    expect(stepRoute(step("car-page"), "abc", owner)).toBe("/dealer/inventory/abc");
    expect(stepRoute(step("vehicle-list"), null, owner)).toBe("/dealer/inventory/list");
  });

  it("gives the owner every step", () => {
    const planned = planFor(TOUR_CHAPTERS, owner, "abc").map(p => p.step.id);
    expect(planned).not.toContain("headline-team"); // the owner sees the money version
    expect(planned.length).toBe(allSteps.length - 1);
  });

  it("never walks sales staff into a page their role can't open", () => {
    const planned = planFor(TOUR_CHAPTERS, as("sales"), "abc");
    const ids = planned.map(p => p.step.id);
    for (const id of ["bookkeeping", "bookkeeping-actions", "profit-breakdown", "decisions", "add-staff", "billing", "settings-owner", "headline-money"]) {
      expect(ids, id).not.toContain(id);
    }
    expect(ids).toContain("headline-team");
    expect(ids).toContain("wanted");
  });

  it("gives finance the books, but not the decision journal, billing or Wanted Cars", () => {
    const ids = planFor(TOUR_CHAPTERS, as("finance"), "abc").map(p => p.step.id);
    expect(ids).toContain("bookkeeping");
    expect(ids).toContain("headline-money");
    expect(ids).not.toContain("decisions");
    expect(ids).not.toContain("billing");
    expect(ids).not.toContain("wanted");
  });

  it("offers a chapter only when there is something in it", () => {
    for (const who of [owner, as("sales"), as("finance"), as("manager"), as("general")]) {
      for (const chapter of chaptersFor(TOUR_CHAPTERS, who, null)) expect(chapter.steps.length).toBeGreaterThan(0);
    }
  });
});

describe("moving through a run", () => {
  const plan = planFor(TOUR_CHAPTERS, owner, "abc");
  const firstOf = (chapterId: string) => plan.findIndex(p => p.chapterId === chapterId);

  it("Skip this section goes to the first step of the next chapter", () => {
    expect(nextChapterStart(plan, 0)).toBe(firstOf("wendy"));
    expect(nextChapterStart(plan, firstOf("wendy") + 1)).toBe(firstOf("stock"));
  });

  it("Skip this section in the last chapter ends the run", () => {
    expect(nextChapterStart(plan, plan.length - 1)).toBeNull();
  });

  it("counts steps within their chapter", () => {
    const around = TOUR_CHAPTERS[0]!.steps.length - 1; // one of the two headline versions
    expect(placeInChapter(plan, 0)).toEqual({ at: 1, of: around });
    expect(placeInChapter(plan, firstOf("wendy") + 1)).toEqual({ at: 2, of: plan.filter(p => p.chapterId === "wendy").length });
  });

  it("runs one chapter on its own", () => {
    const only = planFor(TOUR_CHAPTERS, owner, "abc", "money");
    expect(only.length).toBeGreaterThan(0);
    expect(only.every(p => p.chapterId === "money")).toBe(true);
    expect(nextChapterStart(only, 0)).toBeNull();
  });
});
