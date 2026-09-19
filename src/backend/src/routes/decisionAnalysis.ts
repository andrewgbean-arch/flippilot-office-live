import type { Express, Request, Response } from "express";
import { requireAuth, requireStaffRole, type AuthUser } from "../auth";
import {
  decisionState,
  MAX_ANALYSES_PER_DAY,
  type Confidence,
  type Decision,
  type DecisionAction,
} from "../decisionTypes";
import {
  getDecision,
  mutateDecision,
  returnAnalysisAllowance,
  takeAnalysisAllowance,
  type Actor,
} from "../decisionStore";
import {
  applyConfidenceCap,
  askForJson,
  buildChallengePrompt,
  buildRecommendPrompt,
  parseChallenge,
  parseRecommendation,
  readEvidence,
  type ChallengeDraft,
  type Parsed,
  type Prompt,
  type RecommendationDraft,
} from "../engines/decisionAnalysis";
import { toSingleLine } from "../untrustedText";
import { buildBusinessSummary, callClaude } from "./pilotBrain";

// Pilot's view and the Devil's Advocate (Pilot Brain V8).
//   POST /pilot-brain/decisions/:id/recommend   Pilot's recommendation + reasons + unknowns
//   POST /pilot-brain/decisions/:id/challenge   the Devil's Advocate ("challenge me")
//
// The roadmap rules these routes carry out:
//  - OWNER OR MANAGER ONLY: requireAuth + requireStaffRole("manager") (the owner
//    always passes); anyone else gets 403. (The /pilot-brain prefix is already
//    gated for the subscription and the Pilot Brain add-on in app.ts.)
//  - BOSS DECIDES: only while the decision is still open. A decided or reviewed
//    decision is never touched, and the only thing these routes ever write is a
//    decision record (its pilotRecommendation or devilsAdvocate, plus an event).
//    They never change a car, lead, price or ledger entry.
//  - Every call costs a model call, so it takes one of the dealership's daily
//    allowances FIRST. The allowance is given back if the call fails before a
//    valid answer exists (vendor error, no answer in time, or a reply that could
//    not be read even on the retry). It is NOT given back once a valid answer
//    exists, because that call was paid for, even if the answer then goes
//    unsaved because Boss decided while Pilot was thinking.
//  - The model is called ONCE (plus one retry for an unreadable reply) and never
//    inside mutateDecision's function, which must stay synchronous. The decision
//    is read again inside mutateDecision after the wait, because Boss may have
//    decided in the meantime, or edited its question, context or options (then
//    the answer is about a decision that no longer exists, and its recommended
//    option might not be one of the options now); if so nothing is written.
//  - Confidence is capped in code from the dealership's records (capConfidence),
//    so the model can never claim more than the data supports.

const NOT_FOUND = "That decision wasn't found.";
const NOT_OPEN = "This decision has already been made, so Pilot can no longer add to it. Pilot recommends; Boss decides.";
const DECIDED_MEANWHILE = "Boss decided this while Pilot was working, so Pilot's answer was not saved. Pilot recommends; Boss decides.";
const NO_KEY = "Pilot's AI service isn't switched on for this system yet, so it can't give a view. Please contact FlipPilot support.";
const COULD_NOT_REACH = "Couldn't reach Pilot just now. Nothing was saved and today's allowance was not used. Please try again in a moment.";
const COULD_NOT_READ = "Pilot's answer couldn't be read this time. Nothing was saved and today's allowance was not used. Please try again.";
const SOMETHING_WRONG = "Something went wrong on our side. Nothing was saved. Please try again.";
const EDITED_MEANWHILE = "This decision was edited while Pilot was working, so Pilot's answer was not saved. Please ask again. Pilot recommends; Boss decides.";
const USED_UP = `You have used all ${MAX_ANALYSES_PER_DAY} of today's Pilot views and challenges. They start again tomorrow.`;

// What Pilot is shown of a decision: the words Boss wrote. If any of it changes
// while Pilot is working, the answer is about a decision that no longer exists
// (its recommended option might not even be one of the options now).
const fingerprint = (d: Pick<Decision, "question" | "context" | "options">) => JSON.stringify([d.question, d.context, d.options]);

type Answer = { confidence: Confidence; confidenceReasons: string[] };

// What differs between the two routes; the flow around it is the same.
interface Plan<T extends Answer> {
  action: DecisionAction;
  maxTokens: number;
  prompt: (decision: Decision, evidence: string) => Prompt;
  parse: (json: unknown, decision: Decision) => Parsed<T>;
  hasEarlier: (decision: Decision) => boolean;
  save: (draft: Decision, answer: T, nowIso: string) => void;
  note: (answer: T, again: boolean) => string;
}

const recommendPlan: Plan<RecommendationDraft> = {
  action: "recommendation",
  maxTokens: 900,
  prompt: buildRecommendPrompt,
  parse: parseRecommendation,
  hasEarlier: d => d.pilotRecommendation !== undefined,
  save: (draft, answer, nowIso) => {
    draft.pilotRecommendation = { ...answer, askedAt: nowIso };
  },
  note: (answer, again) =>
    again
      ? `Pilot's view was asked for again and replaced the earlier one: now option ${answer.optionKey}, ${answer.confidence} confidence.`
      : `Pilot's view was asked for: option ${answer.optionKey}, ${answer.confidence} confidence.`,
};

const challengePlan: Plan<ChallengeDraft> = {
  action: "challenge",
  maxTokens: 1500,
  prompt: buildChallengePrompt,
  parse: json => parseChallenge(json),
  hasEarlier: d => d.devilsAdvocate !== undefined,
  save: (draft, answer, nowIso) => {
    draft.devilsAdvocate = { ...answer, ranAt: nowIso };
  },
  note: (answer, again) =>
    again
      ? `The Devil's Advocate was run again and replaced the earlier challenge: ${answer.confidence} confidence.`
      : `The Devil's Advocate was run: ${answer.confidence} confidence.`,
};

async function analyse<T extends Answer>(plan: Plan<T>, req: Request, res: Response): Promise<void> {
  const user = (req as Request & { user: AuthUser }).user;
  const dealershipId = user.dealershipId;
  const id = String(req.params.id ?? "");
  const actor: Actor = { id: user.id, name: toSingleLine(user.name, 80) || "Someone" };

  const decision = getDecision(dealershipId, id);
  if (!decision) {
    res.status(404).json({ ok: false, error: NOT_FOUND });
    return;
  }
  if (decisionState(decision, Date.now()) !== "open") {
    res.status(409).json({ ok: false, error: NOT_OPEN });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({ ok: false, error: NO_KEY });
    return;
  }

  const nowMs = Date.now();
  const allowance = takeAnalysisAllowance(dealershipId, nowMs);
  if (!allowance.ok) {
    res.status(429).json({ ok: false, error: USED_UP });
    return;
  }
  let refunded = false;
  const refund = () => {
    if (refunded) return;
    refunded = true;
    returnAnalysisAllowance(dealershipId, nowMs);
  };

  try {
    // The records the model sees and the counts that cap its confidence are
    // read together, so they describe the same moment.
    const summary = buildBusinessSummary(dealershipId);
    const evidence = readEvidence(dealershipId, nowMs);
    const prompt = plan.prompt(decision, summary);
    const seen = fingerprint(decision);

    const answer = await askForJson({
      call: (system, userMessage, maxTokens) => callClaude(apiKey, system, [{ role: "user", content: userMessage }], maxTokens),
      system: prompt.system,
      user: prompt.user,
      maxTokens: plan.maxTokens,
      parse: json => plan.parse(json, decision),
    });
    if (!answer.ok) {
      console.error(`pilot-brain/decisions ${plan.action}: no usable answer (${answer.reason}): ${answer.detail}`);
      refund();
      res.status(502).json({ ok: false, error: answer.reason === "vendor" ? COULD_NOT_REACH : COULD_NOT_READ });
      return;
    }
    const capped = applyConfidenceCap(answer.value, evidence);

    // Everything from here to the end of mutateDecision is synchronous, so the
    // decision cannot change between the check for an earlier answer and the write.
    const nowIso = new Date().toISOString();
    const earlier = getDecision(dealershipId, id);
    const again = earlier !== undefined && plan.hasEarlier(earlier);
    const saved = mutateDecision(
      dealershipId,
      id,
      actor,
      plan.action,
      draft => {
        // Boss may have decided while the model was answering.
        if (decisionState(draft, Date.now()) !== "open") return DECIDED_MEANWHILE;
        if (fingerprint(draft) !== seen) return EDITED_MEANWHILE;
        plan.save(draft, capped, nowIso);
      },
      plan.note(capped, again),
      nowIso
    );
    if (!saved.ok) {
      res.status(saved.notFound ? 404 : 409).json({ ok: false, error: saved.error });
      return;
    }
    res.json({ ok: true, decision: saved.decision, remaining: allowance.remaining });
  } catch (err) {
    console.error(`pilot-brain/decisions ${plan.action}: unexpected failure`, err);
    refund();
    if (!res.headersSent) res.status(500).json({ ok: false, error: SOMETHING_WRONG });
  }
}

export default function registerDecisionAnalysisRoute(app: Express): void {
  app.post("/pilot-brain/decisions/:id/recommend", requireAuth, requireStaffRole("manager"), (req, res) => {
    void analyse(recommendPlan, req, res);
  });
  app.post("/pilot-brain/decisions/:id/challenge", requireAuth, requireStaffRole("manager"), (req, res) => {
    void analyse(challengePlan, req, res);
  });
}
