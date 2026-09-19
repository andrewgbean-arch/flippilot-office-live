import { describe, it, expect } from "vitest";
import { summarisePreparedActions, PREPARED_ACTIONS_COLLECTION, type QueuedAction } from "./preparedActions";

const act = (type: string, status: string, extra: object = {}): QueuedAction => ({ type, status, ...extra });

describe("summarisePreparedActions", () => {
  it("says so when nothing is waiting", () => {
    expect(summarisePreparedActions([])).toEqual(["Prepared actions waiting for approval in Operations: none."]);
  });

  it("counts only what is still waiting — not approved, rejected, completed or rolled-back ones", () => {
    const lines = summarisePreparedActions([
      act("lead_followup", "prepared"),
      act("lead_followup", "approved"),
      act("lead_followup", "rejected"),
      act("rota_shift", "completed"),
      act("rota_shift", "rolled_back"),
    ]);
    expect(lines).toEqual(["Prepared actions waiting for an owner or manager to approve in Operations: 1 (1 lead follow-up draft)."]);
  });

  it("breaks the queue down by kind, with singular and plural wording", () => {
    const lines = summarisePreparedActions([
      act("lead_followup", "prepared"),
      act("lead_followup", "prepared"),
      act("appointment_followup", "prepared"),
      act("bookkeeping_categorize", "prepared"),
      act("bookkeeping_categorize", "prepared"),
      act("bookkeeping_categorize", "prepared"),
      act("rota_shift", "prepared"),
    ]);
    expect(lines[0]).toBe(
      "Prepared actions waiting for an owner or manager to approve in Operations: 7 (2 lead follow-up drafts, 1 appointment follow-up draft, 3 bookkeeping categorisations, 1 rota shift suggestion)."
    );
  });

  it("counts a kind it doesn't recognise as 'other' rather than dropping it", () => {
    const lines = summarisePreparedActions([act("something_new", "prepared"), act("lead_followup", "prepared")]);
    expect(lines[0]).toContain("2 (1 lead follow-up draft, 1 other)");
  });

  it("never passes on a customer's name or a drafted message", () => {
    const text = summarisePreparedActions([
      act("lead_followup", "prepared", {
        title: "Follow up with Sensitive Person",
        payload: { leadName: "Sensitive Person", draftMessage: "Hi Sensitive Person, SECRET DRAFT" },
      }),
    ]).join("\n");
    expect(text).not.toContain("Sensitive");
    expect(text).not.toContain("SECRET DRAFT");
  });

  it("copes with junk in the stored list", () => {
    expect(() => summarisePreparedActions([null, 4, {}] as unknown as QueuedAction[])).not.toThrow();
  });

  it("names the same collection the Operations screen stores its actions in", () => {
    expect(PREPARED_ACTIONS_COLLECTION).toBe("pilotBrainActions");
  });
});
