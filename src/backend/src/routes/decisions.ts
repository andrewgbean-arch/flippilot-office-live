import type { Express, Request, Response } from "express";
import { requireAuth, requireStaffRole, type AuthUser } from "../auth";
import { createDecision, getDecision, listDecisions, mutateDecision, validateDraft, type Actor } from "../decisionStore";
import { decisionState, type Decision, type DecisionAction } from "../decisionTypes";
import { CLOSE_WITHIN_PERCENT, compareOutcome, journalStats, summariseDecision } from "../engines/decisionJournal";
import {
  parseDecideInput,
  parseOutcomeInput,
  planDecide,
  planEdit,
  planOutcome,
  type Plan,
} from "../engines/decisionJournalInput";

// The Decision Journal routes (Pilot Brain V8), all under /pilot-brain/decisions
// and all OWNER OR MANAGER ONLY (requireAuth + requireStaffRole("manager"); the
// owner always passes). The /pilot-brain prefix is already gated for the
// subscription and the Pilot Brain add-on in app.ts.
//   GET    /pilot-brain/decisions            list summaries (newest first) + learning-loop stats
//   POST   /pilot-brain/decisions            create {question, context, options[]}
//   GET    /pilot-brain/decisions/:id        one full decision, its state, and the comparison once there is an outcome
//   PUT    /pilot-brain/decisions/:id        edit question/context/options: only while open AND Pilot has given no recommendation
//   PUT    /pilot-brain/decisions/:id/decide     Boss's choice + reasoning + expectations (only while open; never again after)
//   PUT    /pilot-brain/decisions/:id/outcome    the actual results + lessons (only once decided, and only once)
// State machine: open -> decided -> reviewed, never backwards. Pilot recommends,
// challenges and simulates; BOSS DECIDES. Nothing here touches a car, a lead, a
// price or the books: only decision records are written, each through
// mutateDecision so every change leaves an event in the audit trail.
//
// Answers: 200 with { ok: true, ... }; 400 the request itself is wrong (the
// error says how); 403 not an owner or manager; 404 no such decision in this
// dealership; 409 the request is fine but the decision can't take it in its
// current state (the error says why).

const managerOnly = [requireAuth, requireStaffRole("manager")];

const authUser = (req: Request): AuthUser => (req as Request & { user: AuthUser }).user;
const actorOf = (user: AuthUser): Actor => ({ id: user.id, name: user.name });

// One decision as the screens want it: the record itself, where it stands, and
// (once what happened has been recorded) each expectation beside its result.
function detailOf(decision: Decision, now: number) {
  return {
    ok: true as const,
    decision,
    state: decisionState(decision, now),
    comparison: decision.outcome ? compareOutcome(decision) : null,
    closeWithinPercent: CLOSE_WITHIN_PERCENT,
  };
}

const NOT_FOUND = { ok: false as const, error: "That decision wasn't found." };

// Makes one change to one decision, safely.
//  1. Look at the decision as it is now and ask the plan whether the change may
//     be made (and what the audit note is). A refusal is answered straight away.
//  2. Make the change with mutateDecision, which reads, changes and writes with
//     no await in between. The plan is asked AGAIN there, about the very copy
//     being changed, so the state rules are checked at the moment of writing
//     and not only before it.
// Nothing is written when the plan refuses.
function change(
  res: Response,
  user: AuthUser,
  id: string,
  action: DecisionAction,
  planFor: (d: Decision) => Plan,
  nowMs: number
): void {
  const before = getDecision(user.dealershipId, id);
  if (!before) {
    res.status(404).json(NOT_FOUND);
    return;
  }
  const first = planFor(before);
  if (!first.ok) {
    res.status(first.status).json({ ok: false, error: first.error });
    return;
  }
  if (first.noChange) {
    res.json(detailOf(before, nowMs));
    return;
  }

  const refused: { plan?: Extract<Plan, { ok: false }> } = {};
  const result = mutateDecision(
    user.dealershipId,
    id,
    actorOf(user),
    action,
    draft => {
      const again = planFor(draft);
      if (!again.ok) {
        refused.plan = again;
        return again.error;
      }
      again.apply(draft);
    },
    first.note,
    new Date(nowMs).toISOString()
  );

  if (!result.ok) {
    if (result.notFound) res.status(404).json(NOT_FOUND);
    else res.status(refused.plan?.status ?? 409).json({ ok: false, error: result.error });
    return;
  }
  res.json(detailOf(result.decision, nowMs));
}

export default function registerDecisionsRoute(app: Express): void {
  app.get("/pilot-brain/decisions", ...managerOnly, (req, res) => {
    const user = authUser(req);
    const now = Date.now();
    const all = listDecisions(user.dealershipId);
    res.json({ ok: true, decisions: all.map(d => summariseDecision(d, now)), stats: journalStats(all, now) });
  });

  app.post("/pilot-brain/decisions", ...managerOnly, (req, res) => {
    const user = authUser(req);
    const draft = validateDraft(req.body);
    if (!draft.ok) return res.status(400).json({ ok: false, error: draft.error });
    const made = createDecision(user.dealershipId, draft.draft, actorOf(user));
    if (!made.ok) return res.status(409).json({ ok: false, error: made.error });
    res.json(detailOf(made.decision, Date.now()));
  });

  app.get("/pilot-brain/decisions/:id", ...managerOnly, (req, res) => {
    const decision = getDecision(authUser(req).dealershipId, String(req.params.id));
    if (!decision) return res.status(404).json(NOT_FOUND);
    res.json(detailOf(decision, Date.now()));
  });

  app.put("/pilot-brain/decisions/:id", ...managerOnly, (req, res) => {
    change(res, authUser(req), String(req.params.id), "edited", d => planEdit(d, req.body), Date.now());
  });

  app.put("/pilot-brain/decisions/:id/decide", ...managerOnly, (req, res) => {
    const user = authUser(req);
    const input = parseDecideInput(req.body);
    if (!input.ok) return res.status(400).json({ ok: false, error: input.error });
    const nowMs = Date.now();
    change(res, user, String(req.params.id), "decided", d => planDecide(d, input.value, { actor: actorOf(user), nowMs }), nowMs);
  });

  app.put("/pilot-brain/decisions/:id/outcome", ...managerOnly, (req, res) => {
    const user = authUser(req);
    const input = parseOutcomeInput(req.body);
    if (!input.ok) return res.status(400).json({ ok: false, error: input.error });
    const nowMs = Date.now();
    change(res, user, String(req.params.id), "outcome", d => planOutcome(d, input.value, { actor: actorOf(user), nowMs }), nowMs);
  });
}
