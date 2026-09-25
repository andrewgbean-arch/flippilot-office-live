// The guided tour: every screen of the app, walked part by part and read by
// Wendy, in chapters that follow the menu. Each screen also carries its written
// guide for the "Help with this page" panel.
//
// Every line must be TRUE of the app as it is. When a screen changes, change
// its chapter file too; scripts/record-tour.ts then re-records only the lines
// whose words changed. Screens and stops someone's role can't open are left out
// for them (tourPlan.ts), so no-one is walked into a lock panel.

import type { TourChapter } from "./tourPlan";
import { chapter as around } from "./chapters/around";
import { chapter as wendy } from "./chapters/wendy";
import { chapter as stock } from "./chapters/stock";
import { chapter as sales } from "./chapters/sales";
import { chapter as workshop } from "./chapters/workshop";
import { chapter as money } from "./chapters/money";
import { chapter as team } from "./chapters/team";
import { chapter as reports } from "./chapters/reports";

export type { TourStep, TourChapter, TourPage, PageGuide } from "./tourPlan";

export const TOUR_CHAPTERS: TourChapter[] = [around, wendy, stock, sales, workshop, money, team, reports];
