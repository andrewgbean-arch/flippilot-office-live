import { describe, it, expect } from "vitest";
import { MAX_BUDGET, MIN_BUDGET, emptyDraft, firstName, problemWith, readBudget, toPayload, type WantedDraft } from "./wantedFormModel";

const good = (over: Partial<WantedDraft> = {}): WantedDraft => ({
  ...emptyDraft,
  name: "Priya Shah",
  email: "priya@example.co.uk",
  make: "Ford",
  model: "Fiesta",
  budget: "£8,000",
  consent: true,
  ...over,
});

describe("the budget", () => {
  it("reads pounds as people write them", () => {
    expect(readBudget("8000")).toBe(8000);
    expect(readBudget("£8,000")).toBe(8000);
    expect(readBudget(" 8 000 ")).toBe(8000);
    expect(readBudget("7999.6")).toBe(8000);
  });

  it("is nothing at all when blank, and null when it isn't a sensible amount", () => {
    for (const blank of ["", "   ", "£"]) expect(readBudget(blank), blank).toBeUndefined();
    for (const bad of ["lots", "8k", "-5000", "12abc", String(MIN_BUDGET - 1), String(MAX_BUDGET + 1), "0"]) expect(readBudget(bad), bad).toBeNull();
  });

  it("allows the limits themselves", () => {
    expect(readBudget(String(MIN_BUDGET))).toBe(MIN_BUDGET);
    expect(readBudget(String(MAX_BUDGET))).toBe(MAX_BUDGET);
  });
});

describe("what is stopping the form being sent", () => {
  it("is nothing for a complete request", () => {
    expect(problemWith(good())).toBeNull();
  });

  it("says what to do, in plain words, for each thing that is missing", () => {
    expect(problemWith(good({ consent: false }))).toMatch(/tick the box/);
    expect(problemWith(good({ name: "  " }))).toMatch(/your name/);
    expect(problemWith(good({ email: "", phone: "" }))).toMatch(/phone number or email/);
    expect(problemWith(good({ make: "", model: "", note: "" }))).toMatch(/looking for/);
    expect(problemWith(good({ make: "", model: "Fiesta", note: "" }))).toMatch(/make as well as the model/);
    expect(problemWith(good({ budget: "lots" }))).toMatch(/£500 and £500,000/);
  });

  it("accepts a phone alone, an email alone, or a few words instead of a make", () => {
    expect(problemWith(good({ email: "", phone: "07700 900123" }))).toBeNull();
    expect(problemWith(good({ make: "", model: "", note: "a small automatic" }))).toBeNull();
    expect(problemWith(good({ budget: "" }))).toBeNull();
  });

  it("doesn't count spaces as an answer", () => {
    expect(problemWith(good({ make: "   ", model: "", note: "   " }))).toMatch(/looking for/);
    expect(problemWith(good({ email: "   ", phone: "   " }))).toMatch(/phone number or email/);
  });

  it("asks for the car first, then how to reach them, then the tick, so the most important thing comes first", () => {
    expect(problemWith(emptyDraft)).toMatch(/looking for/);
    expect(problemWith({ ...emptyDraft, make: "Ford" })).toMatch(/your name/);
    expect(problemWith({ ...emptyDraft, make: "Ford", name: "Priya" })).toMatch(/phone number or email/);
    expect(problemWith({ ...emptyDraft, make: "Ford", name: "Priya", email: "p@x.com" })).toMatch(/tick the box/);
  });
});

describe("what is sent", () => {
  it("sends only what was filled in, trimmed, with the budget as a number and the yes recorded", () => {
    expect(toPayload(good({ name: "  Priya Shah ", model: " Fiesta ", phone: "", note: "  " }))).toEqual({
      consent: true,
      name: "Priya Shah",
      email: "priya@example.co.uk",
      make: "Ford",
      model: "Fiesta",
      maxPrice: 8000,
      website: "",
    });
  });

  it("leaves the budget out when blank, and passes the hidden box through untouched", () => {
    const p = toPayload(good({ budget: "", website: "http://spam.example" }));
    expect(p).not.toHaveProperty("maxPrice");
    expect(p.website).toBe("http://spam.example");
  });
});

describe("first name", () => {
  it("is the first word, or nothing", () => {
    expect(firstName("Priya Shah")).toBe("Priya");
    expect(firstName("  Priya   ")).toBe("Priya");
    expect(firstName("")).toBe("");
    expect(firstName("   ")).toBe("");
  });
});
