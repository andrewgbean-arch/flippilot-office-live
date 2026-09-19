import { describe, it, expect } from "vitest";
import type { Decision } from "@/lib/decisionTypes";
import type { AnalysisResult } from "@/lib/decisionAnalysisApi";
import { analysisAvailability, analysisErrorMessage, editedSince, optionLabel, requestAnalysis, whenText } from "./analysisCardLogic";

const boss = { optionKey: "a", reasoning: "", decidedAt: "2030-01-01T00:00:00Z", decidedByUserId: "u", decidedByName: "n" };
const outcome = { recordedAt: "x", recordedByUserId: "u", recordedByName: "n", actuals: [], notes: "", lessons: { pilotRight: "", pilotWrong: "", bossRight: "", unexpected: "", lesson: "" } };
const NOW = Date.parse("2030-06-01T12:00:00Z");

describe("analysisAvailability: Boss decides, so Pilot is only on offer while it is open", () => {
  it("is on offer while the decision is open", () => {
    expect(analysisAvailability({ bossDecision: undefined, outcome: undefined, reviewDueAt: undefined }, NOW)).toEqual({ available: true });
  });

  it("is closed once Boss has decided, whether or not the review is due yet", () => {
    for (const reviewDueAt of ["2030-07-01T00:00:00Z", "2030-05-01T00:00:00Z", undefined]) {
      const result = analysisAvailability({ bossDecision: boss, outcome: undefined, reviewDueAt }, NOW);
      expect(result).toEqual({ available: false, reason: "Boss has decided, so Pilot's view is closed." });
    }
  });

  it("is closed, with its own reason, once reviewed", () => {
    expect(analysisAvailability({ bossDecision: boss, outcome, reviewDueAt: undefined }, NOW)).toEqual({
      available: false,
      reason: "This decision has been reviewed, so Pilot's view is closed.",
    });
  });
});

describe("analysisErrorMessage: plain words for every way it can fail", () => {
  it("tells anyone who is not an owner or manager so plainly", () => {
    expect(analysisErrorMessage(403, "Your account role (sales) doesn't have access to this.")).toBe(
      "Only owners and managers can ask Pilot for a view or challenge a decision."
    );
  });

  it("passes on the server's own plain message for the daily limit, and has one of its own if there is none", () => {
    expect(analysisErrorMessage(429, "You have used all 20 of today's Pilot views and challenges. They start again tomorrow.")).toContain("all 20");
    expect(analysisErrorMessage(429, undefined)).toContain("today's Pilot views and challenges");
    expect(analysisErrorMessage(429, undefined)).toContain("tomorrow");
  });

  it("says when the server could not be reached", () => {
    expect(analysisErrorMessage(0, "Network error")).toBe("Couldn't reach the server. Check your connection and try again.");
  });

  it("says when the decision was not found, or the session has ended", () => {
    expect(analysisErrorMessage(404, "That decision wasn't found.")).toContain("reloading");
    expect(analysisErrorMessage(401, undefined)).toContain("sign in");
  });

  it("uses the server's words for the rest (a decided decision, a missing service, an unreadable answer)", () => {
    expect(analysisErrorMessage(409, "This decision has already been made.")).toBe("This decision has already been made.");
    expect(analysisErrorMessage(503, "Pilot's AI service isn't switched on for this system yet.")).toBe("Pilot's AI service isn't switched on for this system yet.");
    expect(analysisErrorMessage(502, "Pilot's answer couldn't be read this time.")).toBe("Pilot's answer couldn't be read this time.");
  });

  it("never shows nothing", () => {
    for (const status of [400, 402, 409, 500, 502, 503]) expect(analysisErrorMessage(status, undefined).length).toBeGreaterThan(10);
  });
});

describe("requestAnalysis: one click", () => {
  const decision = { id: "d1" } as Decision;
  const asked: { id: string; kind: string }[] = [];
  const answer = (result: AnalysisResult) => async (id: string, kind: string) => {
    asked.push({ id, kind });
    return result;
  };

  it("hands back the saved decision and what is left of today's allowance", async () => {
    const out = await requestAnalysis("d1", "recommend", answer({ ok: true, status: 200, decision, remaining: 17 }));
    expect(out).toEqual({ ok: true, decision, remaining: 17 });
    expect(asked.at(-1)).toEqual({ id: "d1", kind: "recommend" });
  });

  it("copes with the allowance not being reported", async () => {
    expect(await requestAnalysis("d1", "challenge", answer({ ok: true, status: 200, decision }))).toEqual({ ok: true, decision, remaining: null });
  });

  it("turns a refusal into words to show, not a raw status", async () => {
    expect(await requestAnalysis("d1", "recommend", answer({ ok: false, status: 403 }))).toEqual({
      ok: false,
      error: "Only owners and managers can ask Pilot for a view or challenge a decision.",
    });
    expect(await requestAnalysis("d1", "recommend", answer({ ok: false, status: 429, error: "Used up today." }))).toEqual({ ok: false, error: "Used up today." });
  });

  it("treats a success with no decision in it as a failure rather than showing nothing", async () => {
    const out = await requestAnalysis("d1", "recommend", answer({ ok: true, status: 200 }));
    expect(out.ok).toBe(false);
  });
});

describe("optionLabel", () => {
  const d = { options: [{ key: "a", label: "No change" }, { key: "b", label: "Add £50k" }] };
  it("finds the option by its key", () => {
    expect(optionLabel(d, "b")).toBe("Add £50k");
  });
  it("says so when the option is gone, and never shows a bare letter", () => {
    expect(optionLabel(d, "z")).toBe("an option that is no longer on this decision");
  });
});

describe("editedSince", () => {
  const events = (at: string, action: "edited" | "recommendation" = "edited") => ({ events: [{ at, byUserId: "u", byName: "n", action }] });
  it("is true only when an edit came after the answer", () => {
    expect(editedSince(events("2030-01-01T10:00:00Z"), "2030-01-01T09:00:00Z")).toBe(true);
    expect(editedSince(events("2030-01-01T08:00:00Z"), "2030-01-01T09:00:00Z")).toBe(false);
    expect(editedSince(events("2030-01-01T09:00:00Z"), "2030-01-01T09:00:00Z")).toBe(false);
  });
  it("ignores events that are not edits", () => {
    expect(editedSince(events("2030-01-01T10:00:00Z", "recommendation"), "2030-01-01T09:00:00Z")).toBe(false);
  });
  it("says no rather than guess when a date cannot be read", () => {
    expect(editedSince(events("2030-01-01T10:00:00Z"), "not a date")).toBe(false);
  });
});

describe("whenText", () => {
  it("gives a short UK-time date and time", () => {
    expect(whenText("2030-01-01T09:00:00Z")).toMatch(/^1 Jan,? 09:00$/);
    expect(whenText("2030-07-01T09:00:00Z")).toMatch(/^1 Jul,? 10:00$/);
  });
  it("gives nothing for a date it cannot read", () => {
    expect(whenText("nonsense")).toBe("");
    expect(whenText("")).toBe("");
  });
});
