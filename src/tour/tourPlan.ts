// What a tour run actually walks through, for one person: the chapters (the
// menu's groups), the screens in each, and the stops on each screen, keeping
// only what their role can open and what there is to show (a car's screens
// need a car in stock). Kept free of React so the rules can be tested.

import type { AuthUser } from "@/context/AuthContext";
import { canOpenPage } from "@/lib/pageAccess";

export interface TourRouteContext {
  firstVehicleId: string | null;
}

export type TourRoute = string | ((ctx: TourRouteContext) => string | null);

export interface TourStep {
  id: string; // also the name of its recording: /tour/audio/<id>.mp3
  // What to outline:
  //   "tour-x"          an element with data-tour="tour-x"
  //   "css:<selector>"  the first element matching a CSS selector
  //   "heading:<text>"  the card or section around the heading that starts with <text>
  //   "button:<text>"   the button or link whose text starts with <text>
  //   ""                nothing: the card sits in the middle of the screen
  target: string;
  title: string;
  narration: string;
  // Only on this screen's tour, for some people (the money tiles, say).
  showIf?: (user: AuthUser | null) => boolean;
}

// The written help for one screen, shown in its "Help with this page" panel.
export interface PageGuide {
  summary: string; // what the screen is for, two or three sentences
  // "How do I…?" with numbered steps, in the order someone would do them
  howTo: { question: string; steps: string[] }[];
  tips?: string[];
  // who can use what here, in plain words (left out when everyone can do everything)
  access?: string;
}

export interface TourPage {
  id: string;
  title: string; // as it appears in the menu
  route: TourRoute;
  steps: TourStep[];
  guide?: PageGuide;
  showIf?: (user: AuthUser | null) => boolean;
}

export interface TourChapter {
  id: string;
  title: string;
  blurb: string;
  pages: TourPage[];
}

export interface PlannedStep {
  chapterId: string;
  pageId: string;
  step: TourStep;
  route: string;
}

export function pageRoute(page: TourPage, firstVehicleId: string | null, user: AuthUser | null): string | null {
  if (page.showIf && !page.showIf(user)) return null;
  const route = typeof page.route === "function" ? page.route({ firstVehicleId }) : page.route;
  return route !== null && canOpenPage(user, route) ? route : null;
}

function stepsFor(page: TourPage, user: AuthUser | null): TourStep[] {
  return page.steps.filter(step => !step.showIf || step.showIf(user));
}

// The chapters this person gets, with only the screens (and stops) they get.
export function chaptersFor(chapters: readonly TourChapter[], user: AuthUser | null, firstVehicleId: string | null): TourChapter[] {
  return chapters
    .map(chapter => ({
      ...chapter,
      pages: chapter.pages
        .filter(page => pageRoute(page, firstVehicleId, user) !== null)
        .map(page => ({ ...page, steps: stepsFor(page, user) }))
        .filter(page => page.steps.length > 0),
    }))
    .filter(chapter => chapter.pages.length > 0);
}

export interface RunScope {
  chapterId?: string;
  pageId?: string;
}

// The stops of a run, in order: everything, one chapter, or one screen.
export function planFor(chapters: readonly TourChapter[], user: AuthUser | null, firstVehicleId: string | null, scope: RunScope = {}): PlannedStep[] {
  return chaptersFor(chapters, user, firstVehicleId)
    .filter(chapter => scope.chapterId === undefined || chapter.id === scope.chapterId)
    .flatMap(chapter =>
      chapter.pages
        .filter(page => scope.pageId === undefined || page.id === scope.pageId)
        .flatMap(page => {
          const route = pageRoute(page, firstVehicleId, user)!;
          return page.steps.map(step => ({ chapterId: chapter.id, pageId: page.id, step, route }));
        })
    );
}

// "Skip this screen": the first stop of the next screen, or null at the end.
export function nextPageStart(plan: readonly PlannedStep[], index: number): number | null {
  const here = plan[index]?.pageId;
  for (let i = index + 1; i < plan.length; i++) if (plan[i]!.pageId !== here) return i;
  return null;
}

// Where a stop sits on its screen: "2 of 5".
export function placeOnPage(plan: readonly PlannedStep[], index: number): { at: number; of: number } {
  const here = plan[index]?.pageId;
  return {
    at: plan.slice(0, index + 1).filter(p => p.pageId === here).length,
    of: plan.filter(p => p.pageId === here).length,
  };
}

// Does a screen's route pattern match an address? "/dealer/inventory/:car"
// style routes are written as functions, so they match by their fixed part.
export function pageForPath(chapters: readonly TourChapter[], path: string, firstVehicleId: string | null, user: AuthUser | null): TourPage | null {
  const clean = path.replace(/\/+$/, "") || "/";
  let best: TourPage | null = null;
  for (const chapter of chaptersFor(chapters, user, firstVehicleId)) {
    for (const page of chapter.pages) {
      const route = pageRoute(page, firstVehicleId, user);
      if (!route) continue;
      if (route === clean) return page;
      // a car's screen: the same screen for any car
      const pattern = route.replace(firstVehicleId ?? "\u0000", "[^/]+");
      if (firstVehicleId && pattern !== route && new RegExp(`^${pattern}$`).test(clean)) best = page;
    }
  }
  return best;
}
