import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ScoreGauge, { cleanScore, scoreBand } from "./ScoreGauge";

// The gold rev-counter that shows a score out of 100 as Bad to Excellent.

const render = (props: Parameters<typeof ScoreGauge>[0]) => renderToStaticMarkup(<ScoreGauge {...props} />);

describe("which word a score gets", () => {
  it("runs from Bad to Excellent, changing at the edges", () => {
    const at = (n: number) => scoreBand(n).word;
    expect([at(0), at(24), at(25), at(44), at(45), at(69), at(70), at(84), at(85), at(100)]).toEqual([
      "Bad", "Bad", "Poor", "Poor", "Fair", "Fair", "Good", "Good", "Excellent", "Excellent",
    ]);
  });

  it("agrees with the MOT check's own risk levels: under 45 is high risk, 45 to 69 medium, 70 up low", () => {
    // motAiEngine.ts calls 44 high risk, 45 medium, 69 medium, 70 low. The card must never say
    // "Excellent" next to "high risk", or "Good" next to "medium".
    expect(scoreBand(44).word).toMatch(/Bad|Poor/);
    expect(scoreBand(45).word).toBe("Fair");
    expect(scoreBand(69).word).toBe("Fair");
    expect(scoreBand(70).word).toMatch(/Good|Excellent/);
  });

  it("can move the edges, as the affordability card does so Good starts where its Green starts", () => {
    const edges = [25, 45, 75, 90] as const;
    expect(scoreBand(74, edges).word).toBe("Fair");
    expect(scoreBand(75, edges).word).toBe("Good");
    expect(scoreBand(89, edges).word).toBe("Good");
    expect(scoreBand(90, edges).word).toBe("Excellent");
  });

  it("gives each word its own colour, from red to green", () => {
    const colours = [0, 30, 50, 75, 95].map(n => scoreBand(n).colour);
    expect(new Set(colours).size).toBe(5);
    expect(colours[0]).toBe("#e5432f");
    expect(colours[4]).toBe("#34b35a");
  });
});

describe("reading a score", () => {
  it("rounds and keeps it between 0 and 100", () => {
    expect(cleanScore(32.4)).toBe(32);
    expect(cleanScore(-5)).toBe(0);
    expect(cleanScore(130)).toBe(100);
  });

  it("is no score for anything that is not a real number", () => {
    for (const bad of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) expect(cleanScore(bad)).toBeNull();
  });
});

describe("what is drawn", () => {
  it("shows the word, the score, and a needle turned to it", () => {
    const html = render({ score: 32, label: "Business health" });
    expect(html).toContain("Poor");
    expect(html).toContain("32/100");
    expect(html).toContain("rotate(221.4deg)"); // 135 + 270 x 0.32
    expect(html).toContain('aria-label="Business health: 32 out of 100, Poor"');
  });

  it("points the needle at the start of the dial for 0 and the end for 100", () => {
    expect(render({ score: 0, label: "x" })).toContain("rotate(135deg)");
    expect(render({ score: 100, label: "x" })).toContain("rotate(405deg)");
  });

  it("draws all five bands", () => {
    const html = render({ score: 50, label: "x" });
    for (const colour of ["#e5432f", "#f08a2b", "#f3c431", "#8fc94a", "#34b35a"]) expect(html).toContain(`stroke="${colour}"`);
  });

  it("says there is no data, with no needle and no number, rather than drawing a score of zero", () => {
    for (const missing of [null, undefined, Number.NaN]) {
      const html = render({ score: missing, label: "MOT health" });
      expect(html).toContain("No data");
      expect(html).not.toContain("/100");
      expect(html).not.toContain("rotate(");
      expect(html).toContain('aria-label="MOT health: No data"');
    }
  });

  it("draws the word its own edges give, not the default ones", () => {
    const edges = [25, 45, 75, 90] as const;
    expect(render({ score: 72, label: "x", edges })).toContain("Fair");
    expect(render({ score: 72, label: "x" })).toContain("Good");
  });

  it("never prints null or NaN for a missing score", () => {
    for (const missing of [null, Number.NaN]) expect(render({ score: missing, label: "x" })).not.toMatch(/null|NaN/);
  });

  it("can say something more useful than No data", () => {
    expect(render({ score: null, label: "Market health", noData: "Not checked yet" })).toContain("Not checked yet");
  });

  it("is sized by its width, and never wider than where it sits", () => {
    const html = render({ score: 60, label: "x", width: 140 });
    expect(html).toContain("width:140px");
    expect(html).toContain("max-width:100%");
  });
});

describe("every score out of 100 in the app", () => {
  // The old way printed "{score}/100" as plain text, with its own colour rules that did not
  // agree from screen to screen. They are all drawn by this gauge now.
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap(name => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === "backend" || name === "node_modules" ? [] : walk(path);
      return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) && name !== "ScoreGauge.tsx" ? [path] : [];
    });

  it("is drawn by ScoreGauge, never printed as plain text like {score}/100", () => {
    const offenders = walk(join(__dirname, "..")).filter(file => /\}\/100\b/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("is on every screen that shows one", () => {
    const wired = [
      "pilotbrain/PilotBrainWatcherCard.tsx",
      "pilotbrain/PilotBrainMarketCard.tsx",
      "pilotbrain/PilotBrainStrategy.tsx",
      "components/motors/MOTHealthScore.tsx",
      "components/dealer/AffordabilitySummaryCard.tsx",
    ];
    for (const file of wired) expect(readFileSync(join(__dirname, "..", file), "utf8"), file).toContain("<ScoreGauge");
  });
});
