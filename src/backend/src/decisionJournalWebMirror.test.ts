import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  CLOSE_WITHIN_PERCENT,
  MIN_REVIEWED_FOR_RATES,
  TOO_FEW_REVIEWED_MESSAGE,
} from "./engines/decisionJournal";
import {
  FIGURE_UNITS,
  HORIZON_DAYS_MAX,
  HORIZON_DAYS_MIN,
  MAX_FIGURE_SIZE,
  REVIEW_DAYS_MAX,
  REVIEW_DAYS_MIN,
} from "./engines/decisionJournalInput";

// The Decisions page repeats a few of the server's limits so a form can say what
// the server will accept (src/pilotbrain/decisions/decisionFormat.ts). If the two
// drift, a form promises something the server then turns away, or says "20%" while
// the server means something else. This fails the moment they differ.

const webFile = path.resolve(__dirname, "..", "..", "pilotbrain", "decisions", "decisionFormat.ts");
const web = fs.readFileSync(webFile, "utf8");

const webNumber = (name: string): number | undefined => {
  const m = new RegExp(`^export const ${name} = (\\d+);`, "m").exec(web);
  return m ? Number(m[1]) : undefined;
};

describe("the Decisions page's copy of the server's limits", () => {
  it("has the same numbers", () => {
    expect(webNumber("HORIZON_DAYS_MIN")).toBe(HORIZON_DAYS_MIN);
    expect(webNumber("HORIZON_DAYS_MAX")).toBe(HORIZON_DAYS_MAX);
    expect(webNumber("REVIEW_DAYS_MIN")).toBe(REVIEW_DAYS_MIN);
    expect(webNumber("REVIEW_DAYS_MAX")).toBe(REVIEW_DAYS_MAX);
    expect(webNumber("MAX_FIGURE_SIZE")).toBe(MAX_FIGURE_SIZE);
    expect(webNumber("CLOSE_WITHIN_PERCENT")).toBe(CLOSE_WITHIN_PERCENT);
    expect(webNumber("MIN_REVIEWED_FOR_RATES")).toBe(MIN_REVIEWED_FOR_RATES);
  });

  it("says the same thing when there are too few reviewed decisions", () => {
    expect(web).toContain(`export const TOO_FEW_REVIEWED_MESSAGE = ${JSON.stringify(TOO_FEW_REVIEWED_MESSAGE)};`);
  });

  it("offers exactly the units the server accepts", () => {
    const offered = [...web.matchAll(/\{ value: "(\w+)", label:/g)].map(m => m[1]);
    expect(offered.sort()).toEqual([...FIGURE_UNITS].sort());
  });
});
