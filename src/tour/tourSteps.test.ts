import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AuthUser } from "@/context/AuthContext";
import { TOUR_CHAPTERS } from "./tourSteps";
import { chaptersFor, nextPageStart, pageForPath, pageRoute, placeOnPage, planFor } from "./tourPlan";

const owner = { id: "o", email: "o@x", name: "O", role: "owner", dealershipId: "d" } as AuthUser;
const as = (staffRole: AuthUser["staffRole"]) => ({ ...owner, role: "staff", staffRole }) as AuthUser;
const allPages = TOUR_CHAPTERS.flatMap(c => c.pages);
const allSteps = allPages.flatMap(p => p.steps);
const routeOf = (page: (typeof allPages)[number]) => (typeof page.route === "string" ? page.route : page.route({ firstVehicleId: "car" }));

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
  it("gives every stop and every screen its own id (a stop's id is also the name of its recording)", () => {
    const ids = allSteps.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    const pageIds = allPages.map(p => p.id);
    expect(new Set(pageIds).size).toBe(pageIds.length);
  });

  it("points only at marked things that really are in the app", () => {
    const src = sources();
    for (const s of allSteps) {
      if (!s.target || s.target.includes(":")) continue; // css:, heading:, button: are checked in the browser
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
    const toured = new Set(allPages.map(routeOf));
    for (const page of menuPages) expect(toured.has(page), `${page} is in the menu but not in the tour`).toBe(true);
  });
});

describe("who gets which screens", () => {
  const carPage = allPages.find(p => routeOf(p) === "/dealer/inventory/car")!;

  it("skips a car's screens for a dealer with no stock yet, and keeps them otherwise", () => {
    expect(pageRoute(carPage, null, owner)).toBeNull();
    expect(pageRoute(carPage, "abc", owner)).toBe("/dealer/inventory/abc");
  });

  it("gives the owner every stop except the versions written for other roles", () => {
    const planned = planFor(TOUR_CHAPTERS, owner, "abc").map(p => p.step.id);
    expect(planned).not.toContain("headline-team");
    expect(planned).toContain("headline-money");
    const forOwner = allSteps.filter(s => !s.showIf || s.showIf(owner));
    expect(planned.length).toBe(forOwner.length);
  });

  it("never walks sales staff into a screen their role can't open", () => {
    const routes = new Set(planFor(TOUR_CHAPTERS, as("sales"), "abc").map(p => p.route));
    for (const locked of ["/bookkeeping", "/dealer/finance/profit-breakdown", "/pilot-brain/decisions", "/dealer/staff/add", "/billing"]) {
      expect(routes.has(locked), locked).toBe(false);
    }
    expect(routes.has("/dealer/sales/wanted")).toBe(true);
  });

  it("gives finance the books, but not the decision journal, billing or Wanted Cars", () => {
    const routes = new Set(planFor(TOUR_CHAPTERS, as("finance"), "abc").map(p => p.route));
    expect(routes.has("/bookkeeping")).toBe(true);
    expect(routes.has("/pilot-brain/decisions")).toBe(false);
    expect(routes.has("/billing")).toBe(false);
    expect(routes.has("/dealer/sales/wanted")).toBe(false);
  });

  it("offers a chapter only when it has a screen, and a screen only when it has a stop", () => {
    for (const who of [owner, as("sales"), as("finance"), as("manager"), as("general")]) {
      for (const chapter of chaptersFor(TOUR_CHAPTERS, who, null)) {
        expect(chapter.pages.length).toBeGreaterThan(0);
        for (const page of chapter.pages) expect(page.steps.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("moving through a run", () => {
  const plan = planFor(TOUR_CHAPTERS, owner, "abc");

  it("Skip this screen goes to the first stop of the next screen, and ends the run on the last", () => {
    const next = nextPageStart(plan, 0)!;
    expect(plan[next]!.pageId).not.toBe(plan[0]!.pageId);
    expect(plan[next - 1]!.pageId).toBe(plan[0]!.pageId);
    expect(nextPageStart(plan, plan.length - 1)).toBeNull();
  });

  it("counts stops on their own screen", () => {
    const first = plan.filter(p => p.pageId === plan[0]!.pageId).length;
    expect(placeOnPage(plan, 0)).toEqual({ at: 1, of: first });
  });

  it("runs one chapter, or one screen, on its own", () => {
    const chapter = planFor(TOUR_CHAPTERS, owner, "abc", { chapterId: TOUR_CHAPTERS[1]!.id });
    expect(chapter.length).toBeGreaterThan(0);
    expect(chapter.every(p => p.chapterId === TOUR_CHAPTERS[1]!.id)).toBe(true);
    const onePage = allPages[3]!;
    const screen = planFor(TOUR_CHAPTERS, owner, "abc", { pageId: onePage.id });
    expect(screen.map(p => p.step.id)).toEqual(onePage.steps.filter(s => !s.showIf || s.showIf(owner)).map(s => s.id));
  });

  it("knows which screen an address is, including any car's screens", () => {
    expect(pageForPath(TOUR_CHAPTERS, "/dealer-dashboard", "abc", owner)?.route).toBe("/dealer-dashboard");
    expect(routeOf(pageForPath(TOUR_CHAPTERS, "/dealer/inventory/some-other-car", "abc", owner)!)).toBe("/dealer/inventory/car");
    expect(pageForPath(TOUR_CHAPTERS, "/nowhere", "abc", owner)).toBeNull();
    // not for someone whose role can't open it
    expect(pageForPath(TOUR_CHAPTERS, "/bookkeeping", "abc", as("sales"))).toBeNull();
  });
});
