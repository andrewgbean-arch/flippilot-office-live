// What a tour run actually walks through, for one person: the chapters and
// steps their role can open, with the ones that have nothing to show (a car's
// page when there is no stock yet) left out. Kept free of React so the rules
// can be tested on their own.

import type { AuthUser } from "@/context/AuthContext";
import { canOpenPage } from "@/lib/pageAccess";

export interface TourRouteContext {
  firstVehicleId: string | null;
}

export interface TourStep {
  id: string; // also the name of its recorded narration: /tour/audio/<id>.mp3
  // A fixed address, or one worked out from the dealer's own data (a car's
  // page); null means "nothing to show here, skip this step".
  route: string | ((ctx: TourRouteContext) => string | null);
  // What to spotlight: a data-tour="..." id, or "css:<selector>", or "" for a
  // card on its own in the middle of the screen.
  target: string;
  title: string;
  narration: string;
  // Extra rule on top of "can this person open the page", for a step that
  // only makes sense for some people (the money tiles, say).
  showIf?: (user: AuthUser | null) => boolean;
}

export interface TourChapter {
  id: string;
  title: string;
  blurb: string; // one line on the chapter menu
  steps: TourStep[];
}

export interface PlannedStep {
  chapterId: string;
  step: TourStep;
  route: string;
}

// Where a step takes this person, or null to skip it.
export function stepRoute(step: TourStep, firstVehicleId: string | null, user: AuthUser | null): string | null {
  if (step.showIf && !step.showIf(user)) return null;
  const route = typeof step.route === "function" ? step.route({ firstVehicleId }) : step.route;
  return route !== null && canOpenPage(user, route) ? route : null;
}

// The chapters this person gets, each with only the steps they get; a chapter
// left with no steps isn't offered at all.
export function chaptersFor(chapters: readonly TourChapter[], user: AuthUser | null, firstVehicleId: string | null): TourChapter[] {
  return chapters
    .map(chapter => ({ ...chapter, steps: chapter.steps.filter(step => stepRoute(step, firstVehicleId, user) !== null) }))
    .filter(chapter => chapter.steps.length > 0);
}

// The steps of a run, in order: every chapter (the full tour), or just one.
export function planFor(
  chapters: readonly TourChapter[],
  user: AuthUser | null,
  firstVehicleId: string | null,
  onlyChapterId?: string
): PlannedStep[] {
  return chaptersFor(chapters, user, firstVehicleId)
    .filter(chapter => onlyChapterId === undefined || chapter.id === onlyChapterId)
    .flatMap(chapter =>
      chapter.steps.map(step => ({ chapterId: chapter.id, step, route: stepRoute(step, firstVehicleId, user)! }))
    );
}

// "Skip this section": the first step of the next chapter, or null at the end.
export function nextChapterStart(plan: readonly PlannedStep[], index: number): number | null {
  const here = plan[index]?.chapterId;
  for (let i = index + 1; i < plan.length; i++) if (plan[i]!.chapterId !== here) return i;
  return null;
}

// Where a step sits inside its chapter: "2 of 5".
export function placeInChapter(plan: readonly PlannedStep[], index: number): { at: number; of: number } {
  const here = plan[index]?.chapterId;
  const inChapter = plan.filter(p => p.chapterId === here);
  const at = plan.slice(0, index + 1).filter(p => p.chapterId === here).length;
  return { at, of: inChapter.length };
}
