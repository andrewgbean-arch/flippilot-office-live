import "./testPrivateDatabase.js"; // must stay first: see that file
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import request from "supertest";
import app from "./app.js";
import { readTenantCollection, writeTenantCollection, writeTenantDoc, readTenantDoc } from "./db.js";
import { signToken } from "./auth.js";
import { getDecision, listDecisions, mutateDecision } from "./decisionStore.js";
import type { Decision } from "./decisionTypes.js";

// The Decision Journal routes, through the real app: who may use them, what each
// one does, and the state machine (open -> decided -> reviewed, never backwards).
// Pilot's recommendation is added straight to the store where a test needs one
// (the analysis routes are a different part of V8).

vi.setConfig({ testTimeout: 90_000 });

const runId = Date.now();
let counter = 0;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

type StaffRole = "sales" | "finance" | "manager" | "general";
interface Account {
  token: string;
  user: { id: string; name: string; dealershipId: string };
}

async function signup(tag: string): Promise<Account> {
  counter += 1;
  const res = await request(app)
    .post("/auth/signup")
    .send({ email: `journal-${runId}-${tag}-${counter}@test.local`, password: "journaltestpass123", name: `Journal ${tag}`, dealershipName: `Journal Motors ${tag} ${counter}` });
  if (!res.body.token) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user };
}

async function joinStaff(owner: Account, staffRole: StaffRole): Promise<Account> {
  const invite = await request(app).post("/dealership/invite").set(auth(owner.token)).send({ inviteeName: `Journal ${staffRole}`, staffRole });
  if (!invite.body.token) throw new Error(`invite failed: ${JSON.stringify(invite.body)}`);
  counter += 1;
  const res = await request(app)
    .post("/auth/join")
    .send({ token: invite.body.token, name: `Journal ${staffRole}`, email: `journal-${runId}-${staffRole}-${counter}@test.local`, password: "journaltestpass123" });
  if (!res.body.token) throw new Error(`join failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user };
}

const list = (t: string) => request(app).get("/pilot-brain/decisions").set(auth(t));
const create = (t: string, body: unknown = GOOD) => request(app).post("/pilot-brain/decisions").set(auth(t)).send(body as object);
const readOne = (t: string, id: string) => request(app).get(`/pilot-brain/decisions/${id}`).set(auth(t));
const edit = (t: string, id: string, body: unknown) => request(app).put(`/pilot-brain/decisions/${id}`).set(auth(t)).send(body as object);
const decide = (t: string, id: string, body: unknown) => request(app).put(`/pilot-brain/decisions/${id}/decide`).set(auth(t)).send(body as object);
const outcome = (t: string, id: string, body: unknown) => request(app).put(`/pilot-brain/decisions/${id}/outcome`).set(auth(t)).send(body as object);

const GOOD = { question: "Buy another £50k of SUVs?", context: "Enquiries are up.", options: ["No change", "Add £50k", "Add £25k"] };
const EXPECTATIONS = [
  { metric: "Extra profit", unit: "gbp", expected: 5000, horizonDays: 90, basis: "Last spring" },
  { metric: "Cars sold", unit: "cars", expected: 4, horizonDays: 60, basis: "" },
];

let owner: Account;
let manager: Account;
let general: Account;
let sales: Account;
let finance: Account;
let otherOwner: Account;

beforeAll(async () => {
  owner = await signup("owner");
  manager = await joinStaff(owner, "manager");
  general = await joinStaff(owner, "general");
  sales = await joinStaff(owner, "sales");
  finance = await joinStaff(owner, "finance");
  otherOwner = await signup("other");
});

const dealerOf = () => owner.user.dealershipId;
const stored = (id: string) => getDecision(dealerOf(), id)!;

async function newDecision(who: Account = owner, body: unknown = GOOD): Promise<Decision> {
  const res = await create(who.token, body);
  if (res.status !== 200) throw new Error(`create failed: ${JSON.stringify(res.body)}`);
  return res.body.decision as Decision;
}

// Pilot gives a view, as the analysis route will (written straight to the store).
function pilotRecommends(dealershipId: string, id: string, optionKey: string): void {
  const r = mutateDecision(
    dealershipId,
    id,
    { id: "pilot", name: "Pilot" },
    "recommendation",
    d => {
      d.pilotRecommendation = { optionKey, reasoning: "The numbers support it.", confidence: "medium", confidenceReasons: ["Six months of sales"], unknowns: [], askedAt: new Date().toISOString() };
    },
    "Pilot gave a recommendation"
  );
  if (!r.ok) throw new Error(r.error);
}

afterEach(() => {
  vi.useRealTimers();
});

// ---- who may use it ----

describe("the journal is for owners and managers only", () => {
  it("turns away someone who is not logged in", async () => {
    expect((await request(app).get("/pilot-brain/decisions")).status).toBe(401);
    expect((await request(app).post("/pilot-brain/decisions").send(GOOD)).status).toBe(401);
  });

  it.each([["general"], ["sales"], ["finance"]])("answers 403 to a %s account on every route, and writes nothing", async role => {
    const who = { general, sales, finance }[role as "general" | "sales" | "finance"];
    const target = await newDecision(owner);
    const before = JSON.stringify(listDecisions(dealerOf()));

    const attempts = [
      list(who.token),
      create(who.token),
      readOne(who.token, target.id),
      edit(who.token, target.id, { question: "Changed by the wrong person?" }),
      decide(who.token, target.id, { optionKey: "a" }),
      outcome(who.token, target.id, {}),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/doesn't have access/);
    }
    expect(JSON.stringify(listDecisions(dealerOf()))).toBe(before);
  });

  it("lets a manager do all of it", async () => {
    const made = await create(manager.token);
    expect(made.status).toBe(200);
    const id = made.body.decision.id as string;
    expect(made.body.decision.createdByName).toBe("Journal manager");
    expect((await list(manager.token)).status).toBe(200);
    expect((await readOne(manager.token, id)).status).toBe(200);
    expect((await edit(manager.token, id, { context: "Manager edit." })).status).toBe(200);
    expect((await decide(manager.token, id, { optionKey: "a" })).status).toBe(200);
    expect((await outcome(manager.token, id, {})).status).toBe(200);
  });

  it("lets the owner do all of it", async () => {
    const d = await newDecision(owner);
    expect((await edit(owner.token, d.id, { context: "Owner edit." })).status).toBe(200);
    expect((await decide(owner.token, d.id, { optionKey: "b" })).status).toBe(200);
    expect((await outcome(owner.token, d.id, {})).status).toBe(200);
  });
});

// ---- creating, listing, reading ----

describe("creating and reading decisions", () => {
  it("creates an open decision with a created event, and sends back where it stands", async () => {
    const res = await create(owner.token);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.state).toBe("open");
    expect(res.body.comparison).toBeNull();
    expect(res.body.closeWithinPercent).toBe(20);
    const d = res.body.decision as Decision;
    expect(d.question).toBe("Buy another £50k of SUVs?");
    expect(d.options.map(o => `${o.key}:${o.label}`)).toEqual(["a:No change", "b:Add £50k", "c:Add £25k"]);
    expect(d.createdByUserId).toBe(owner.user.id);
    expect(d.events).toEqual([{ at: d.createdAt, byUserId: owner.user.id, byName: "Journal owner", action: "created" }]);
    expect(stored(d.id)).toEqual(d);
  });

  it("refuses a decision that is not a real question with real options, in plain English, and stores nothing", async () => {
    const before = listDecisions(dealerOf()).length;
    const cases: Array<[unknown, RegExp]> = [
      [{ ...GOOD, question: "   " }, /write the question/],
      [{ ...GOOD, options: ["Only one"] }, /at least 2 options/],
      [{ ...GOOD, options: "not a list" }, /between 2 and 6 options/],
      [{ ...GOOD, options: Array.from({ length: 7 }, (_, i) => `Option ${i}`) }, /at most 6 options/],
      [{ ...GOOD, options: ["Same", "same"] }, /its own name/],
      [{}, /write the question/],
    ];
    for (const [body, message] of cases) {
      const res = await create(owner.token, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body).toMatchObject({ ok: false, error: expect.stringMatching(message) });
    }
    expect(listDecisions(dealerOf()).length).toBe(before);
  });

  it("cleans what was typed: one line for the question, no hidden characters", async () => {
    const hidden = String.fromCodePoint(0xe0041);
    const d = await newDecision(owner, { ...GOOD, question: `Line one\nline two${hidden}` });
    expect(d.question).toBe("Line one line two");
  });

  it("lists the newest first, with what the screen needs, and the stats", async () => {
    const who = await signup("lister");
    await create(who.token, { ...GOOD, question: "First" });
    await new Promise(r => setTimeout(r, 5));
    const second = (await create(who.token, { ...GOOD, question: "Second" })).body.decision as Decision;
    pilotRecommends(who.user.dealershipId, second.id, "b");
    await decide(who.token, second.id, { optionKey: "b" });

    const res = await list(who.token);
    expect(res.status).toBe(200);
    expect(res.body.decisions.map((d: { question: string }) => d.question)).toEqual(["Second", "First"]);
    expect(res.body.decisions[0]).toEqual({
      id: second.id,
      question: "Second",
      state: "decided",
      createdAt: second.createdAt,
      decidedAt: expect.any(String),
      chosenOption: "Add £50k",
      followedPilot: true,
      reviewDueAt: expect.any(String),
      hasRecommendation: true,
      hasChallenge: false,
      simulationCount: 0,
    });
    expect(res.body.decisions[1]).toMatchObject({ question: "First", state: "open", chosenOption: null, followedPilot: null, decidedAt: null, reviewDueAt: null, hasRecommendation: false });
    expect(res.body.stats).toMatchObject({ total: 2, counts: { open: 1, decided: 1, review_due: 0, reviewed: 0 }, followedPilot: 1, overrodePilot: 0, enoughReviewed: false });
  });

  it("reads one full decision, and answers 404 for one that does not exist", async () => {
    const d = await newDecision(owner);
    const res = await readOne(owner.token, d.id);
    expect(res.status).toBe(200);
    expect(res.body.decision).toEqual(d);
    expect(res.body.state).toBe("open");
    const missing = await readOne(owner.token, "no-such-decision");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ ok: false, error: "That decision wasn't found." });
  });
});

describe("each dealership only sees and changes its own decisions", () => {
  it("answers 404 for another dealership's decision on every route, and changes nothing", async () => {
    const mine = await newDecision(owner);
    const before = JSON.stringify(stored(mine.id));

    const attempts = [
      readOne(otherOwner.token, mine.id),
      edit(otherOwner.token, mine.id, { question: "Hijacked?" }),
      decide(otherOwner.token, mine.id, { optionKey: "a" }),
      outcome(otherOwner.token, mine.id, {}),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ ok: false, error: "That decision wasn't found." });
    }
    expect(JSON.stringify(stored(mine.id))).toBe(before);
    expect(listDecisions(otherOwner.user.dealershipId).some(d => d.id === mine.id)).toBe(false);
  });

  it("never lists another dealership's decisions", async () => {
    const mine = await newDecision(owner, { ...GOOD, question: "Only mine" });
    const theirs = await list(otherOwner.token);
    expect(theirs.status).toBe(200);
    expect(theirs.body.decisions.some((d: { id: string }) => d.id === mine.id)).toBe(false);
    expect(theirs.body.stats.total).toBe(theirs.body.decisions.length);
  });
});

// ---- editing ----

describe("editing the question and options", () => {
  it("changes what was sent while the decision is open, lettering the options again, and records an edit", async () => {
    const d = await newDecision(owner);
    const res = await edit(owner.token, d.id, { question: "Buy £40k of SUVs?", options: ["Hold", "Buy £40k"] });
    expect(res.status).toBe(200);
    expect(res.body.decision.question).toBe("Buy £40k of SUVs?");
    expect(res.body.decision.context).toBe("Enquiries are up."); // not sent, so kept
    expect(res.body.decision.options).toEqual([{ key: "a", label: "Hold" }, { key: "b", label: "Buy £40k" }]);
    const events = stored(d.id).events;
    expect(events.map(e => e.action)).toEqual(["created", "edited"]);
    expect(events[1]).toMatchObject({ byUserId: owner.user.id, byName: "Journal owner", note: "Edited the question and options." });
    expect(stored(d.id).updatedAt >= d.updatedAt).toBe(true);
  });

  it("answers 200 and adds no event when nothing actually changes", async () => {
    const d = await newDecision(owner);
    const res = await edit(owner.token, d.id, { question: d.question, options: d.options });
    expect(res.status).toBe(200);
    expect(stored(d.id).events).toHaveLength(1);
  });

  it("refuses once Pilot has given a recommendation, saying why, and changes nothing", async () => {
    const d = await newDecision(owner);
    pilotRecommends(dealerOf(), d.id, "b");
    const before = JSON.stringify(stored(d.id));

    for (const body of [{ options: ["A different", "Set of options"] }, { question: "A different question?" }, { context: "Different context" }]) {
      const res = await edit(owner.token, d.id, body);
      expect(res.status).toBe(409);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Pilot has already given a view on these options/);
      expect(res.body.error).toMatch(/changes? what that view refers to/);
    }
    expect(JSON.stringify(stored(d.id))).toBe(before);
  });

  it("refuses once Boss has decided", async () => {
    const d = await newDecision(owner);
    await decide(owner.token, d.id, { optionKey: "a" });
    const before = JSON.stringify(stored(d.id));
    const res = await edit(owner.token, d.id, { question: "Too late?" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already been made/);
    expect(JSON.stringify(stored(d.id))).toBe(before);
  });

  it("refuses what is not valid, and what says nothing, with 400", async () => {
    const d = await newDecision(owner);
    const before = JSON.stringify(stored(d.id));
    expect((await edit(owner.token, d.id, {})).status).toBe(400);
    expect((await edit(owner.token, d.id, { question: "  " })).status).toBe(400);
    expect((await edit(owner.token, d.id, { options: ["Only one"] })).status).toBe(400);
    expect(JSON.stringify(stored(d.id))).toBe(before);
  });
});

// ---- deciding ----

describe("Boss decides", () => {
  it("records the choice, who made it, the expectations and a review date, and moves the decision to decided", async () => {
    const d = await newDecision(owner);
    const res = await decide(owner.token, d.id, { optionKey: "b", reasoning: "Enquiries are up.", expectations: EXPECTATIONS, reviewInDays: 30 });
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("decided");
    const after = res.body.decision as Decision;
    expect(after.bossDecision).toMatchObject({ optionKey: "b", reasoning: "Enquiries are up.", decidedByUserId: owner.user.id, decidedByName: "Journal owner" });
    expect(after.bossDecision).not.toHaveProperty("otherText");
    expect(after.expectations.map(e => [e.metric, e.unit, e.expected, e.horizonDays, e.basis])).toEqual([
      ["Extra profit", "gbp", 5000, 90, "Last spring"],
      ["Cars sold", "cars", 4, 60, ""],
    ]);
    expect(new Set(after.expectations.map(e => e.id)).size).toBe(2);
    // review date is exactly 30 days after the moment of deciding
    expect(Date.parse(after.reviewDueAt!) - Date.parse(after.bossDecision!.decidedAt)).toBe(30 * 86_400_000);
    expect(stored(d.id)).toEqual(after);
  });

  it("reviews in 90 days unless told otherwise", async () => {
    const d = await newDecision(owner);
    const after = (await decide(owner.token, d.id, { optionKey: "a" })).body.decision as Decision;
    expect(Date.parse(after.reviewDueAt!) - Date.parse(after.bossDecision!.decidedAt)).toBe(90 * 86_400_000);
  });

  it("takes Other with a few words, and only then", async () => {
    const d = await newDecision(owner);
    expect((await decide(owner.token, d.id, { optionKey: "other" })).status).toBe(400);
    expect(stored(d.id).bossDecision).toBeUndefined();
    const res = await decide(owner.token, d.id, { optionKey: "other", otherText: "Wait a month and look again" });
    expect(res.status).toBe(200);
    expect(res.body.decision.bossDecision).toMatchObject({ optionKey: "other", otherText: "Wait a month and look again" });
  });

  it("can only be done once: the second attempt is refused, and the first choice stands", async () => {
    const d = await newDecision(owner);
    const first = await decide(owner.token, d.id, { optionKey: "a", reasoning: "First thoughts" });
    expect(first.status).toBe(200);
    const before = JSON.stringify(stored(d.id));

    const second = await decide(owner.token, d.id, { optionKey: "b", reasoning: "Changed my mind" });
    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/already been made and can't be changed/);
    expect(second.body.error).toMatch(/record what actually happened/);
    expect(JSON.stringify(stored(d.id))).toBe(before);
    expect(stored(d.id).bossDecision).toMatchObject({ optionKey: "a", reasoning: "First thoughts" });
  });

  it("can only be done once even when two people press the button at the same moment", async () => {
    const d = await newDecision(owner);
    const [a, b] = await Promise.all([
      decide(owner.token, d.id, { optionKey: "a", reasoning: "Owner's view" }),
      decide(manager.token, d.id, { optionKey: "b", reasoning: "Manager's view" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const events = stored(d.id).events.filter(e => e.action === "decided");
    expect(events).toHaveLength(1);
    const winner = a.status === 200 ? { key: "a", by: "Journal owner" } : { key: "b", by: "Journal manager" };
    expect(stored(d.id).bossDecision).toMatchObject({ optionKey: winner.key, decidedByName: winner.by });
  });

  it("refuses an option the decision does not have, and every kind of bad input, and writes nothing", async () => {
    const d = await newDecision(owner);
    const before = JSON.stringify(stored(d.id));
    const cases: Array<[unknown, RegExp]> = [
      [{ optionKey: "d" }, /isn't one of this decision's options/], // there are only a, b, c
      [{ optionKey: "z" }, /choose one of the options/],
      [{}, /choose one of the options/],
      [{ optionKey: "a", expectations: Array.from({ length: 7 }, () => EXPECTATIONS[0]) }, /at most 6 expectations/],
      [{ optionKey: "a", expectations: [{ ...EXPECTATIONS[0], unit: "pounds" }] }, /what it is measured in/],
      [{ optionKey: "a", expectations: [{ ...EXPECTATIONS[0], expected: "5000" }] }, /the number you expect/],
      [{ optionKey: "a", expectations: [{ ...EXPECTATIONS[0], horizonDays: 0 }] }, /in how many days/],
      [{ optionKey: "a", expectations: [{ ...EXPECTATIONS[0], metric: "" }] }, /what you are measuring/],
      [{ optionKey: "a", reviewInDays: 3 }, /between 7 and 365 days/],
      [{ optionKey: "a", reviewInDays: 400 }, /between 7 and 365 days/],
    ];
    for (const [body, message] of cases) {
      const res = await decide(owner.token, d.id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body).toMatchObject({ ok: false, error: expect.stringMatching(message) });
    }
    expect(JSON.stringify(stored(d.id))).toBe(before);
    // and it still works afterwards: nothing was half done
    expect((await decide(owner.token, d.id, { optionKey: "a" })).status).toBe(200);
  });

  it("says in the audit trail that Boss FOLLOWED Pilot's recommendation", async () => {
    const d = await newDecision(owner);
    pilotRecommends(dealerOf(), d.id, "b");
    await decide(owner.token, d.id, { optionKey: "b" });
    const event = stored(d.id).events.at(-1)!;
    expect(event.action).toBe("decided");
    expect(event.note).toBe(`Boss followed Pilot's recommendation: option B, "Add £50k".`);
  });

  it("says in the audit trail that Boss OVERRODE Pilot's recommendation, and what each was", async () => {
    const d = await newDecision(owner);
    pilotRecommends(dealerOf(), d.id, "b");
    await decide(owner.token, d.id, { optionKey: "a" });
    const event = stored(d.id).events.at(-1)!;
    expect(event.note).toBe(`Boss overrode Pilot's recommendation. Pilot recommended option B, "Add £50k"; Boss chose option A, "No change".`);
  });

  it("counts Other as an override, and says when there was no recommendation to follow", async () => {
    const overridden = await newDecision(owner);
    pilotRecommends(dealerOf(), overridden.id, "c");
    await decide(owner.token, overridden.id, { optionKey: "other", otherText: "Do nothing" });
    expect(stored(overridden.id).events.at(-1)!.note).toMatch(/^Boss overrode Pilot's recommendation/);

    const alone = await newDecision(owner);
    await decide(owner.token, alone.id, { optionKey: "a" });
    expect(stored(alone.id).events.at(-1)!.note).toMatch(/^Boss decided without a recommendation from Pilot/);
  });

  it("leaves the audit trail in order: created, edited, decided, outcome, each by the person who did it", async () => {
    const d = await newDecision(owner);
    await edit(manager.token, d.id, { context: "Manager's context." });
    await decide(owner.token, d.id, { optionKey: "a", expectations: EXPECTATIONS });
    const exps = stored(d.id).expectations;
    await outcome(manager.token, d.id, { actuals: [{ expectationId: exps[0]!.id, actual: 5100 }] });

    const events = stored(d.id).events;
    expect(events.map(e => [e.action, e.byName])).toEqual([
      ["created", "Journal owner"],
      ["edited", "Journal manager"],
      ["decided", "Journal owner"],
      ["outcome", "Journal manager"],
    ]);
    const times = events.map(e => Date.parse(e.at));
    expect([...times].sort((x, y) => x - y)).toEqual(times);
  });
});

// ---- what actually happened ----

describe("recording what actually happened", () => {
  async function decidedWithExpectations() {
    const d = await newDecision(owner);
    const decided = (await decide(owner.token, d.id, { optionKey: "b", expectations: EXPECTATIONS })).body.decision as Decision;
    return { id: d.id, e0: decided.expectations[0]!.id, e1: decided.expectations[1]!.id };
  }

  it("cannot be done before Boss has decided, and writes nothing", async () => {
    const d = await newDecision(owner);
    const before = JSON.stringify(stored(d.id));
    const res = await outcome(owner.token, d.id, { notes: "Too early" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/hasn't been made yet/);
    expect(JSON.stringify(stored(d.id))).toBe(before);
    expect(stored(d.id).outcome).toBeUndefined();
  });

  it("records the results, notes and lessons, moves the decision to reviewed, and sends back the comparison", async () => {
    const { id, e0, e1 } = await decidedWithExpectations();
    const res = await outcome(owner.token, id, {
      actuals: [
        { expectationId: e0, actual: 5400, note: "One sold late" },
        { expectationId: e1, actual: 2 },
      ],
      notes: "Slower than hoped, but profitable.",
      lessons: { pilotRight: "Demand was there", pilotWrong: "Sold fewer", bossRight: "Buying early", unexpected: "A price war", lesson: "Buy in March" },
    });
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("reviewed");
    expect(res.body.decision.outcome).toMatchObject({
      recordedByUserId: owner.user.id,
      recordedByName: "Journal owner",
      notes: "Slower than hoped, but profitable.",
      lessons: { pilotRight: "Demand was there", pilotWrong: "Sold fewer", bossRight: "Buying early", unexpected: "A price war", lesson: "Buy in March" },
    });
    // 5000 -> 5400 is +8% (close); 4 -> 2 is -50% (below)
    expect(res.body.comparison).toEqual([
      expect.objectContaining({ expectationId: e0, metric: "Extra profit", expected: 5000, actual: 5400, delta: 400, deltaPercent: 8, verdict: "close", note: "One sold late" }),
      expect.objectContaining({ expectationId: e1, metric: "Cars sold", expected: 4, actual: 2, delta: -2, deltaPercent: -50, verdict: "below" }),
    ]);
    expect(res.body.closeWithinPercent).toBe(20);
    const events = stored(id).events;
    expect(events.at(-1)).toMatchObject({ action: "outcome", note: "Recorded what happened: 2 of 2 results known." });
    // and the comparison comes with a plain read of the decision too
    const again = await readOne(owner.token, id);
    expect(again.body.comparison).toEqual(res.body.comparison);
  });

  it("counts a result nobody gave as not known, and keeps a real 0 apart from it", async () => {
    const { id, e0, e1 } = await decidedWithExpectations();
    const res = await outcome(owner.token, id, { actuals: [{ expectationId: e1, actual: 0 }] }); // e0 left out
    expect(res.status).toBe(200);
    expect(res.body.decision.outcome.actuals).toEqual([
      { expectationId: e0, actual: null },
      { expectationId: e1, actual: 0 },
    ]);
    expect(res.body.comparison[0]).toMatchObject({ actual: null, delta: null, deltaPercent: null, verdict: "unknown" });
    expect(res.body.comparison[1]).toMatchObject({ actual: 0, delta: -4, deltaPercent: -100, verdict: "below" });
    expect(stored(id).events.at(-1)!.note).toBe("Recorded what happened: 1 of 2 results known.");
  });

  it("can only be done once: a review is final, and the second attempt changes nothing", async () => {
    const { id, e0 } = await decidedWithExpectations();
    expect((await outcome(owner.token, id, { actuals: [{ expectationId: e0, actual: 5000 }], notes: "First" })).status).toBe(200);
    const before = JSON.stringify(stored(id));
    const second = await outcome(owner.token, id, { actuals: [{ expectationId: e0, actual: 1 }], notes: "Second" });
    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/already been recorded/);
    expect(JSON.stringify(stored(id))).toBe(before);
  });

  it("does not let the decision itself be changed after it has been reviewed", async () => {
    const { id } = await decidedWithExpectations();
    await outcome(owner.token, id, {});
    const before = JSON.stringify(stored(id));
    expect((await decide(owner.token, id, { optionKey: "a" })).status).toBe(409);
    expect((await edit(owner.token, id, { question: "Rewrite history?" })).status).toBe(409);
    expect(JSON.stringify(stored(id))).toBe(before);
  });

  it("refuses a result for an expectation that is not there, one given twice, or one that is not a number, and writes nothing", async () => {
    const { id, e0 } = await decidedWithExpectations();
    const before = JSON.stringify(stored(id));
    const cases: Array<[unknown, RegExp]> = [
      [{ actuals: [{ expectationId: "ghost", actual: 1 }] }, /doesn't match anything you expected/],
      [{ actuals: [{ expectationId: e0, actual: 1 }, { expectationId: e0, actual: 2 }] }, /only have one result/],
      [{ actuals: [{ expectationId: e0, actual: "lots" }] }, /please give a number, or leave it as not known/],
      [{ actuals: [{ actual: 4 }] }, /which expectation it is for/],
      [{ actuals: "none" }, /must be a list/],
    ];
    for (const [body, message] of cases) {
      const res = await outcome(owner.token, id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body).toMatchObject({ ok: false, error: expect.stringMatching(message) });
    }
    expect(JSON.stringify(stored(id))).toBe(before);
    expect((await outcome(owner.token, id, { actuals: [{ expectationId: e0, actual: 5000 }] })).status).toBe(200); // still possible afterwards
  });

  it("cleans and caps the notes and lessons with the store's cleaners", async () => {
    const { id } = await decidedWithExpectations();
    const hidden = String.fromCodePoint(0xe0041);
    const res = await outcome(owner.token, id, { notes: `Notes${hidden}`, lessons: { lesson: `l${hidden}`.repeat(900), pilotRight: "  keep me  " } });
    expect(res.status).toBe(200);
    const o = res.body.decision.outcome;
    expect(o.notes).toBe("Notes");
    expect(Array.from(o.lessons.lesson as string).length).toBeLessThanOrEqual(400);
    expect(o.lessons.lesson).not.toContain(hidden);
    expect(o.lessons.pilotRight).toBe("keep me");
    expect(o.lessons.bossRight).toBe("");
  });

  it("works for a decision with no expectations at all", async () => {
    const d = await newDecision(owner);
    await decide(owner.token, d.id, { optionKey: "a" });
    const res = await outcome(owner.token, d.id, { notes: "It went fine." });
    expect(res.status).toBe(200);
    expect(res.body.comparison).toEqual([]);
    expect(stored(d.id).events.at(-1)!.note).toBe("Recorded what happened. No expectations had been set.");
  });
});

// ---- time and the learning loop ----

describe("a decision becomes review-due when its date passes", () => {
  it("moves from decided to review due, and back to reviewed once the outcome is recorded", async () => {
    const who = await signup("clock");
    const d = (await create(who.token)).body.decision as Decision;
    await decide(who.token, d.id, { optionKey: "a", reviewInDays: 7 });

    expect((await readOne(who.token, d.id)).body.state).toBe("decided");
    expect((await list(who.token)).body.stats.counts).toMatchObject({ decided: 1, review_due: 0 });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 8 * 86_400_000);
    // A login is good for 7 days, so a fresh one is made for the new time.
    const later = signToken({ id: who.user.id, email: "x@test.local", name: who.user.name, role: "owner", dealershipId: who.user.dealershipId });
    expect((await readOne(later, d.id)).body.state).toBe("review_due");
    const listed = await list(later);
    expect(listed.body.decisions[0].state).toBe("review_due");
    expect(listed.body.stats.counts).toMatchObject({ decided: 0, review_due: 1 });

    expect((await outcome(later, d.id, {})).body.state).toBe("reviewed");
    vi.useRealTimers();
  });
});

describe("the learning-loop stats, through the route", () => {
  // Each helper makes a decision with one expectation of 100, follows or overrides
  // Pilot, and records the given actual.
  async function reviewedDecision(who: Account, opts: { followed: boolean; actual: number | null }) {
    const d = (await create(who.token)).body.decision as Decision;
    pilotRecommends(who.user.dealershipId, d.id, "b");
    const decided = (await decide(who.token, d.id, { optionKey: opts.followed ? "b" : "a", expectations: [{ metric: "Profit", unit: "gbp", expected: 100, horizonDays: 30 }] })).body.decision as Decision;
    await outcome(who.token, d.id, { actuals: [{ expectationId: decided.expectations[0]!.id, actual: opts.actual }] });
  }

  it("says there are too few reviewed decisions until three are reviewed, then gives the sentence", async () => {
    const who = await signup("stats");
    await reviewedDecision(who, { followed: true, actual: 110 }); // close
    await reviewedDecision(who, { followed: false, actual: 300 }); // above
    let stats = (await list(who.token)).body.stats;
    expect(stats.reviewedDecisions).toBe(2);
    expect(stats.enoughReviewed).toBe(false);
    expect(stats.summary).toMatch(/too few reviewed decisions to say anything yet/i);
    expect(stats.followedPilot).toBe(1);
    expect(stats.overrodePilot).toBe(1);

    await reviewedDecision(who, { followed: true, actual: null }); // not known
    stats = (await list(who.token)).body.stats;
    expect(stats.reviewedDecisions).toBe(3);
    expect(stats.enoughReviewed).toBe(true);
    expect(stats.tally).toEqual({ close: 1, above: 1, below: 0, unknown: 1, total: 3 });
    expect(stats.summary).toBe(
      "Across 3 reviewed decisions: 1 of 2 results came out close to what you expected (within 20%), 1 above and 0 below. 1 result was not known, so not counted."
    );
    expect(stats.followedPilot).toBe(2);
    expect(stats.overrodePilot).toBe(1);
    expect(stats.closeWithinPercent).toBe(20);
  });
});

// ---- the boundary: only decision records are written ----

describe("Boss decides: the journal never changes anything else in the business", () => {
  it("leaves cars, leads, the books and every other collection exactly as they were", async () => {
    const who = await signup("untouched");
    const id = who.user.dealershipId;
    const vehicles = [{ id: "v1", make: "BMW", model: "X5", priceRetail: 24995, status: "in stock" }];
    const leads = [{ id: "l1", name: "A Customer", status: "new", source: "AutoTrader" }];
    const bookkeeping = { purchases: [{ vehicleId: "v1", purchasePrice: 20000, date: "2030-01-01" }], sales: [], costs: [] };
    writeTenantCollection(id, "vehicles", vehicles);
    writeTenantCollection(id, "leads", leads);
    writeTenantDoc(id, "bookkeeping", bookkeeping);
    const snapshot = () => JSON.stringify([readTenantCollection(id, "vehicles"), readTenantCollection(id, "leads"), readTenantDoc(id, "bookkeeping", null)]);
    const before = snapshot();

    const d = (await create(who.token, { question: "Reduce the X5 to £22,995?", options: ["Reduce", "Hold"] })).body.decision as Decision;
    await edit(who.token, d.id, { context: "It has been in stock 90 days." });
    pilotRecommends(id, d.id, "a");
    const decided = (await decide(who.token, d.id, { optionKey: "a", expectations: [{ metric: "Days to sell", unit: "days", expected: 14, horizonDays: 30 }] })).body.decision as Decision;
    await outcome(who.token, d.id, { actuals: [{ expectationId: decided.expectations[0]!.id, actual: 20 }] });
    await list(who.token);
    await readOne(who.token, d.id);

    expect(snapshot()).toBe(before);
  });
});
