import { useState } from "react";
import type { Decision } from "@/lib/decisionTypes";
import {
  decideDecision,
  editDecision,
  recordOutcome,
  type DecideBody,
  type DecisionDetail,
  type DecisionDraftInput,
  type OutcomeBody,
} from "@/lib/decisionsApi";
import AnalysisCard from "./AnalysisCard";
import AuditTrail from "./AuditTrail";
import BossDecisionForm from "./BossDecisionForm";
import DecisionForm from "./DecisionForm";
import DecisionRecord from "./DecisionRecord";
import OutcomeForm from "./OutcomeForm";
import SimulatorPanel from "./SimulatorPanel";
import { Card, StateChip } from "./decisionUi";
import { followText, followedPilot, formatDate } from "./decisionFormat";

// One decision, start to finish: what it is, what Pilot thinks (Pilot's view and
// "Challenge me"), what a simulation says, Boss's choice, and later what actually
// happened. Pilot recommends; nothing here changes a car, a lead, a price or the
// books. Only this decision record is written.

// The options, with the one Pilot recommended and the one Boss chose marked in words.
export function OptionsList({ decision }: { decision: Decision }) {
  const recKey = decision.pilotRecommendation?.optionKey;
  const chosenKey = decision.bossDecision?.optionKey;
  return (
    <div>
      {decision.options.map(o => (
        <div key={o.key} className={`dj-option${chosenKey === o.key ? " dj-option--chosen" : ""}`} style={{ cursor: "default" }}>
          <span className="dj-letter" title={`Option ${o.key.toUpperCase()}`}>
            {o.key.toUpperCase()}
          </span>
          <span style={{ color: "#f5f7ff" }}>
            {o.label}
            {recKey === o.key ? (
              <span className="dj-chip dj-chip--plain" style={{ marginLeft: 8 }}>
                Pilot recommended
              </span>
            ) : null}
            {chosenKey === o.key ? (
              <span className="dj-chip dj-chip--decided" style={{ marginLeft: 8 }}>
                Your choice
              </span>
            ) : null}
            {o.note ? (
              <span className="dj-small" style={{ display: "block" }}>
                {o.note}
              </span>
            ) : null}
          </span>
        </div>
      ))}
      {chosenKey === "other" ? (
        <div className="dj-option dj-option--chosen" style={{ cursor: "default" }}>
          <span style={{ color: "#f5f7ff" }}>
            Other: {decision.bossDecision?.otherText}
            <span className="dj-chip dj-chip--decided" style={{ marginLeft: 8 }}>
              Your choice
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default function DecisionDetailView({
  detail,
  nowMs,
  onDetail,
  onPanelChange,
  onRefresh,
  onBack,
}: {
  detail: DecisionDetail;
  nowMs: number;
  onDetail: (next: DecisionDetail) => void;
  onPanelChange: (next: Decision) => void;
  onRefresh: () => void;
  onBack: () => void;
}) {
  const { decision, state, comparison, closeWithinPercent } = detail;
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [decideError, setDecideError] = useState<string | null>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);

  const follow = followText(followedPilot(decision));
  const canEdit = state === "open" && !decision.pilotRecommendation;

  // Runs one save. If the server says the decision has moved on (409: someone else
  // decided it a moment ago, say), the screen is refreshed so it shows the truth.
  async function save(
    run: () => ReturnType<typeof decideDecision>,
    setError: (message: string | null) => void,
    done?: () => void
  ) {
    setBusy(true);
    setError(null);
    const res = await run();
    setBusy(false);
    if (res.ok) {
      done?.();
      onDetail({ decision: res.decision, state: res.state, comparison: res.comparison, closeWithinPercent: res.closeWithinPercent });
      return;
    }
    setError(res.error);
    if (res.status === 409) onRefresh();
  }

  const submitEdit = (draft: DecisionDraftInput) =>
    save(() => editDecision(decision.id, draft), setEditError, () => setEditing(false));
  const submitDecide = (body: DecideBody) => save(() => decideDecision(decision.id, body), setDecideError);
  const submitOutcome = (body: OutcomeBody) => save(() => recordOutcome(decision.id, body), setOutcomeError);

  return (
    <div>
      <button type="button" className="sn-btn sn-btn--ghost dj-btn" onClick={onBack} style={{ marginBottom: 12 }}>
        &larr; All decisions
      </button>

      <Card gold>
        <h2 className="dj-h2" style={{ fontSize: 18, color: "#f5f7ff" }}>
          {decision.question}
        </h2>
        <div className="dj-chips" style={{ marginBottom: 8 }}>
          <StateChip state={state} />
          {follow ? <span className="dj-chip dj-chip--plain">{follow}</span> : null}
        </div>
        <p className="dj-small" style={{ margin: "0 0 8px" }}>
          Written by {decision.createdByName} on {formatDate(decision.createdAt)}.
        </p>
        {decision.context ? (
          <p className="dj-muted" style={{ whiteSpace: "pre-wrap" }}>
            {decision.context}
          </p>
        ) : null}

        <h3 className="dj-h3" style={{ marginTop: 12 }}>
          The options
        </h3>
        <OptionsList decision={decision} />

        {canEdit && !editing ? (
          <button type="button" className="sn-btn sn-btn--ghost" onClick={() => setEditing(true)}>
            Edit the question and options
          </button>
        ) : null}
        {state === "open" && decision.pilotRecommendation ? (
          <p className="dj-small">The question and options are locked, because Pilot has given a recommendation about them. To change them, write a new decision.</p>
        ) : null}
      </Card>

      {editing ? (
        <DecisionForm
          heading="Edit this decision"
          submitLabel="Save changes"
          initial={{ question: decision.question, context: decision.context, options: decision.options.map(o => o.label) }}
          busy={busy}
          error={editError}
          onSubmit={submitEdit}
          onCancel={() => {
            setEditing(false);
            setEditError(null);
          }}
        />
      ) : null}

      <AnalysisCard decision={decision} onChange={onPanelChange} />
      <SimulatorPanel decision={decision} onChange={onPanelChange} />

      {state === "open" ? (
        <BossDecisionForm decision={decision} busy={busy} error={decideError} onSubmit={submitDecide} />
      ) : (
        <DecisionRecord decision={decision} state={state} comparison={comparison} closeWithinPercent={closeWithinPercent} nowMs={nowMs} />
      )}

      {state === "decided" || state === "review_due" ? (
        <OutcomeForm decision={decision} busy={busy} error={outcomeError} onSubmit={submitOutcome} />
      ) : null}

      <AuditTrail events={decision.events} />
    </div>
  );
}
