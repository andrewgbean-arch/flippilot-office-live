import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect } from "vitest";
import { TASTER_QUESTIONS, readTasterState, tasterQuestionsRemaining, recordTasterQuestion, recordTasterBriefing } from "./pilotBrainTaster.js";

const dealershipId = () => `taster-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe("the free Pilot Brain taster", () => {
  it("starts with all 5 questions and the briefing unused", () => {
    const id = dealershipId();
    expect(readTasterState(id)).toEqual({ questionsUsed: 0, briefingUsed: false });
    expect(tasterQuestionsRemaining(id)).toBe(TASTER_QUESTIONS);
  });

  it("counts down one at a time and never below zero remaining", () => {
    const id = dealershipId();
    for (let i = 1; i <= TASTER_QUESTIONS; i++) {
      recordTasterQuestion(id);
      expect(tasterQuestionsRemaining(id)).toBe(TASTER_QUESTIONS - i);
    }
    expect(tasterQuestionsRemaining(id)).toBe(0);
    recordTasterQuestion(id); // one more than the allowance, just in case a caller forgets to check first
    expect(tasterQuestionsRemaining(id)).toBe(0);
  });

  it("the briefing is a separate one-off flag from the questions", () => {
    const id = dealershipId();
    recordTasterQuestion(id);
    expect(readTasterState(id)).toMatchObject({ questionsUsed: 1, briefingUsed: false });
    recordTasterBriefing(id);
    expect(readTasterState(id)).toMatchObject({ questionsUsed: 1, briefingUsed: true });
  });

  it("is never reset by anything — a lifetime allowance, not a daily or monthly one", () => {
    const id = dealershipId();
    for (let i = 0; i < TASTER_QUESTIONS; i++) recordTasterQuestion(id);
    recordTasterBriefing(id);
    // No "new day"/"new month" concept exists here at all: re-reading later still shows it used up.
    expect(tasterQuestionsRemaining(id)).toBe(0);
    expect(readTasterState(id).briefingUsed).toBe(true);
  });

  it("keeps one dealership's taster separate from another's", () => {
    const a = dealershipId();
    const b = dealershipId();
    recordTasterQuestion(a);
    recordTasterBriefing(a);
    expect(readTasterState(b)).toEqual({ questionsUsed: 0, briefingUsed: false });
  });
});
