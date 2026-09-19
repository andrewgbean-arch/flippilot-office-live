import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireStaffRole, type AuthUser } from "./auth";
import { writeTenantCollection } from "./db";
import { createDecision, listDecisions, mutateDecision, validateDraft } from "./decisionStore";
import { EDITABLE } from "./pilotBrainEdits";
import { canSeeDecisions, tabsFor } from "./pilotBrainTabs";
import { buildClientTools, tenantEditDeps, tenantTabSource } from "./pilotBrainTools";

// Pilot Brain (Wendy) reading the REAL Decision Journal: the decisions are made
// by the store's own functions, in a real (private, temporary) database, and read
// back through tenantTabSource and the look_inside tool. The unit tests for the
// tab itself (pilotBrainTabs.test.ts) use hand-made data; these prove the wiring
// and that the real shape the store writes is the shape the tab expects.

const newDealer = () => `pilot-brain-decisions-tab-${crypto.randomUUID()}`;
const actor = { id: "u-owner", name: "SECRET Olivia Owner" };
const asUser = (role: "owner" | "staff", staffRole?: AuthUser["staffRole"]): AuthUser =>
  ({ id: "u1", email: "u@example.test", name: "Asker", role, dealershipId: "d1", ...(staffRole ? { staffRole } : {}) }) as AuthUser;
const owner = asUser("owner");
const manager = asUser("staff", "manager");
const finance = asUser("staff", "finance");
const sales = asUser("staff", "sales");
const general = asUser("staff", "general");

function draftOf(input: unknown) {
  const v = validateDraft(input);
  if (!v.ok) throw new Error("draft should be valid: " + v.error);
  return v.draft;
}

// One decision taken through its whole life by the store's own functions, with
// private-looking text in every place a careless projection could leak from.
function decisionTakenThroughItsWholeLife(dealer: string, question = "Buy another £50k of SUVs?") {
  const made = createDecision(
    dealer,
    draftOf({
      question,
      context: "SECRET context: my brother-in-law Dave (07700900123) says the market is hot",
      options: [{ label: "No change", note: "SECRET note on no change" }, { label: "Add £50k", note: "SECRET note on add" }, { label: "Add £25k" }],
    }),
    actor,
    "2030-01-01T09:00:00.000Z"
  );
  if (!made.ok) throw new Error("setup: " + made.error);
  const id = made.decision.id;
  const step = (action: Parameters<typeof mutateDecision>[3], change: Parameters<typeof mutateDecision>[4], at: string) => {
    const r = mutateDecision(dealer, id, actor, action, change, "SECRET event note", at);
    if (!r.ok) throw new Error("setup: " + r.error);
  };
  step("recommendation", d => {
    d.pilotRecommendation = { optionKey: "c", reasoning: "SECRET Pilot reasoning", confidence: "medium", confidenceReasons: ["SECRET reason"], unknowns: ["SECRET unknown"], askedAt: "2030-01-01T10:00:00.000Z" };
  }, "2030-01-01T10:00:00.000Z");
  step("challenge", d => {
    d.devilsAdvocate = {
      ranAt: "2030-01-01T11:00:00.000Z", caseFor: ["SECRET for"], caseAgainst: ["SECRET against"], assumptions: ["SECRET assumption"], unknowns: ["SECRET unknown"],
      downside: "SECRET downside", alternative: "SECRET alternative", pilotView: "SECRET view", confidence: "low", confidenceReasons: ["SECRET reason"],
    };
  }, "2030-01-01T11:00:00.000Z");
  step("simulation", d => {
    d.simulations = [{
      id: "s1", ranAt: "2030-01-01T12:00:00.000Z", kind: "stock_investment", title: "SECRET simulation title",
      assumptions: [{ key: "k", label: "SECRET assumption", value: 5, unit: "cars", source: "boss", kind: "predicted" }],
      scenarios: [{ key: "keep", label: "SECRET scenario", figures: [] }], confidence: "medium", confidenceReasons: ["SECRET reason"], note: "SECRET simulation note",
    }];
  }, "2030-01-01T12:00:00.000Z");
  step("decided", d => {
    d.bossDecision = { optionKey: "c", reasoning: "Cash is tight, so keep it small.", decidedAt: "2030-01-02T09:00:00.000Z", decidedByUserId: "SECRET-user", decidedByName: "SECRET Boss" };
    d.expectations = [
      { id: "e1", metric: "Cars sold", unit: "cars", expected: 4, horizonDays: 90, basis: "SECRET basis" },
      { id: "e2", metric: "Gross profit", unit: "gbp", expected: 6000, horizonDays: 90, basis: "SECRET basis" },
    ];
    d.reviewDueAt = "2030-04-01T09:00:00.000Z";
  }, "2030-01-02T09:00:00.000Z");
  step("outcome", d => {
    d.outcome = {
      recordedAt: "2030-04-05T09:00:00.000Z", recordedByUserId: "SECRET-user", recordedByName: "SECRET Recorder",
      actuals: [{ expectationId: "e1", actual: 3, note: "SECRET actual note" }, { expectationId: "e2", actual: null }],
      notes: "SECRET outcome notes",
      lessons: { pilotRight: "SECRET right", pilotWrong: "SECRET wrong", bossRight: "SECRET boss right", unexpected: "SECRET unexpected", lesson: "Buy in smaller batches." },
    };
  }, "2030-04-05T09:00:00.000Z");
  return id;
}

const lookAsJson = (dealer: string, user: AuthUser, input: object = { tab: "decisions" }) =>
  JSON.parse(buildClientTools(user, tenantTabSource(dealer)).execute("look_inside", input));

describe("Pilot Brain reads the real Decision Journal", () => {
  it("reads it through the store's own reader: this dealership's decisions, newest first, and nobody else's", () => {
    const mine = newDealer();
    const theirs = newDealer();
    createDecision(mine, draftOf({ question: "older", options: ["a", "b"] }), actor, "2030-01-01T00:00:00.000Z");
    createDecision(mine, draftOf({ question: "newer", options: ["a", "b"] }), actor, "2030-02-01T00:00:00.000Z");
    createDecision(theirs, draftOf({ question: "somebody else's", options: ["a", "b"] }), actor, "2030-03-01T00:00:00.000Z");

    const rows = tenantTabSource(mine).list("decisions") as { question: string }[];
    expect(rows.map(r => r.question)).toEqual(["newer", "older"]);
    expect(rows).toEqual(listDecisions(mine));

    const out = lookAsJson(mine, manager);
    expect(out.ok).toBe(true);
    expect(out.records.map((r: { question: string }) => r.question)).toEqual(["newer", "older"]);
    expect(JSON.stringify(out)).not.toContain("somebody else's");
  });

  it("gives a whole real decision, from open to reviewed, as the fixed fields and nothing more", () => {
    const dealer = newDealer();
    const id = decisionTakenThroughItsWholeLife(dealer);

    const out = lookAsJson(dealer, manager);
    expect(out.ok).toBe(true);
    expect(out.total).toBe(1);
    expect(out.records[0]).toEqual({
      id,
      question: "Buy another £50k of SUVs?",
      state: "reviewed",
      chosenOption: "Add £25k",
      followedPilot: true,
      pilotConfidence: "medium",
      createdAt: "2030-01-01T09:00:00.000Z",
      decidedAt: "2030-01-02T09:00:00.000Z",
      reviewDueAt: "2030-04-01T09:00:00.000Z",
      simulationCount: 1,
      results: [
        { metric: "Cars sold", unit: "cars", expected: 4, expectedKind: "predicted", actual: 3, actualKind: "known", verdict: "lower than expected" },
        { metric: "Gross profit", unit: "gbp", expected: 6000, expectedKind: "predicted", actual: "not known", actualKind: "unknown", verdict: "not known" },
      ],
      bossReasoning: "Cash is tight, so keep it small.",
      lesson: "Buy in smaller batches.",
    });
    const json = JSON.stringify(out);
    for (const word of ["SECRET", "Dave", "07700900123", "brother-in-law", "market is hot"]) expect(json, word).not.toContain(word);
  });

  it("gives an owner the same, and refuses sales, finance and general staff, using the real stored decision", () => {
    const dealer = newDealer();
    decisionTakenThroughItsWholeLife(dealer);
    expect(lookAsJson(dealer, owner).records).toHaveLength(1);
    for (const who of [sales, finance, general, asUser("staff")]) {
      const out = lookAsJson(dealer, who);
      expect(out.ok, who.staffRole ?? "no role").toBe(false);
      expect(out.error).toContain("isn't allowed to open the decisions tab");
      expect(JSON.stringify(out)).not.toContain("SUVs");
    }
  });

  it("only reads: the stored journal is exactly the same afterwards, events and timestamps included", () => {
    const dealer = newDealer();
    decisionTakenThroughItsWholeLife(dealer);
    const before = JSON.stringify(listDecisions(dealer));
    for (const input of [{ tab: "decisions" }, { tab: "decisions", status: "reviewed" }, { tab: "decisions", search: "suvs", limit: 3 }, { tab: "decisions", since: "2030-01-01" }, { tab: "decisions", limit: "x" }]) {
      lookAsJson(dealer, manager, input);
      lookAsJson(dealer, sales, input);
    }
    expect(JSON.stringify(listDecisions(dealer))).toBe(before);
    expect(listDecisions(dealer)[0]!.events.map(e => e.action)).toEqual(["created", "recommendation", "challenge", "simulation", "decided", "outcome"]);
  });

  it("says there is nothing when the journal is empty", () => {
    const out = lookAsJson(newDealer(), owner);
    expect(out).toMatchObject({ ok: true, tab: "decisions", total: 0, returned: 0, records: [] });
  });

  it("copes with junk rows in the stored journal: the reader drops what isn't a decision and the tab copes with the rest", () => {
    const dealer = newDealer();
    writeTenantCollection(dealer, "pilotBrainDecisions", [null, 7, "x", { nothing: "here" }, { id: "d-odd", createdAt: "2030-01-01T00:00:00.000Z", question: "Odd one", options: "no", outcome: 5 }]);
    const out = lookAsJson(dealer, owner);
    expect(out.ok).toBe(true);
    expect(out.records.map((r: { id: string }) => r.id)).toEqual(["d-odd"]);
  });

  it("still reads every other tab from its own collection", () => {
    const dealer = newDealer();
    writeTenantCollection(dealer, "vehicles", [{ id: "v1", reg: "AB12CDE", make: "BMW", model: "3 Series", status: "in stock", createdAt: "2030-01-01T00:00:00.000Z" }]);
    const rows = tenantTabSource(dealer).list("vehicles") as { reg: string }[];
    expect(rows.map(r => r.reg)).toEqual(["AB12CDE"]);
    expect(lookAsJson(dealer, sales, { tab: "inventory" }).records[0]).toMatchObject({ reg: "AB12CDE" });
    expect(tenantTabSource(dealer).list("leads")).toEqual([]);
  });
});

describe("the tab's role rule is the routes' role rule", () => {
  // The Decisions routes are requireAuth + requireStaffRole("manager"). If the
  // two ever disagree, Pilot Brain would show someone what the screen won't.
  function passesTheRoute(user: AuthUser): boolean {
    let passed = false;
    const res = { status: () => res, json: () => res } as unknown as Response;
    requireStaffRole("manager")({ user } as unknown as Request, res, (() => void (passed = true)) as NextFunction);
    return passed;
  }

  it.each([
    ["an owner", owner],
    ["an owner whose account also carries a staff role", asUser("owner", "sales")],
    ["a manager", manager],
    ["a finance member", finance],
    ["a sales member", sales],
    ["a general staff member", general],
    ["a staff account with no staff role", asUser("staff")],
  ])("lets %s in exactly when requireStaffRole('manager') does", (_who, who) => {
    expect(canSeeDecisions(who)).toBe(passesTheRoute(who));
    expect(tabsFor(who).includes("decisions")).toBe(passesTheRoute(who));
  });

  it("is true for the owner and the manager, and false for everyone else (so the parity above is not two falses)", () => {
    expect([owner, manager].map(passesTheRoute)).toEqual([true, true]);
    expect([finance, sales, general, asUser("staff")].map(passesTheRoute)).toEqual([false, false, false, false]);
  });
});

describe("Pilot Brain has no way to write the journal", () => {
  const src = path.resolve(__dirname);
  const brainFiles = [
    ...fs.readdirSync(src).filter(f => /^pilotBrain.*\.ts$/.test(f) && !f.endsWith(".test.ts")).map(f => path.join(src, f)),
    path.join(src, "routes", "pilotBrain.ts"),
  ];
  const read = (file: string) => fs.readFileSync(file, "utf8");

  it("really found the files it is checking", () => {
    const names = brainFiles.map(f => path.basename(f));
    for (const expected of ["pilotBrainTabs.ts", "pilotBrainTools.ts", "pilotBrainToolCore.ts", "pilotBrainGuide.ts", "pilotBrainEdits.ts", "pilotBrainShield.ts", "pilotBrainWeb.ts", "pilotBrain.ts"]) {
      expect(names, expected).toContain(expected);
    }
  });

  it("imports only the reader from the decision store, and nowhere names what writes a decision", () => {
    let importsOfTheStore = 0;
    for (const file of brainFiles) {
      const code = read(file);
      for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.{1,2}\/decisionStore"/g)) {
        importsOfTheStore += 1;
        expect(m[1]!.split(",").map(s => s.trim()).filter(Boolean), path.basename(file)).toEqual(["listDecisions"]);
      }
      for (const writer of ["createDecision", "mutateDecision", "takeAnalysisAllowance", "returnAnalysisAllowance", "pilotBrainDecisions"]) {
        expect(code, `${path.basename(file)} must not mention ${writer}`).not.toContain(writer);
      }
    }
    expect(importsOfTheStore).toBe(1); // pilotBrainTools.ts, for the tab
  });

  it("has nothing editable called a decision, and offers only look_inside and prepare_edit, whoever asks", () => {
    expect(Object.keys(EDITABLE)).toEqual(["vehicle", "lead", "job"]);
    const dealer = newDealer();
    for (const who of [owner, manager, sales, finance, general]) {
      const names = buildClientTools(who, tenantTabSource(dealer), tenantEditDeps(dealer)).definitions.map((d: any) => d.name);
      expect(names.every((n: string) => n === "look_inside" || n === "prepare_edit"), who.staffRole ?? who.role).toBe(true);
    }
  });

  it("changes nothing in the journal even when the model tries to prepare an edit to a decision", () => {
    const dealer = newDealer();
    const id = decisionTakenThroughItsWholeLife(dealer);
    const before = JSON.stringify(listDecisions(dealer));
    const tools = buildClientTools(owner, tenantTabSource(dealer), tenantEditDeps(dealer));
    for (const input of [
      { kind: "decision", id, field: "question", value: "changed", reason: "A specific reason from the records." },
      { kind: "decision", id, field: "bossDecision", value: "a", reason: "A specific reason from the records." },
    ]) {
      const out = JSON.parse(tools.execute("prepare_edit", input));
      expect(out.ok).toBe(false);
    }
    expect(JSON.stringify(listDecisions(dealer))).toBe(before);
  });
});
