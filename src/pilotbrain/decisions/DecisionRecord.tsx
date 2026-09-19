import type { Decision, DecisionState } from "@/lib/decisionTypes";
import type { ExpectationResult } from "@/lib/decisionsApi";
import ComparisonTable from "./ComparisonTable";
import { KindTag } from "./decisionUi";
import { FOLLOW_TEXT, LESSON_FIELDS, chosenOptionText, followedPilot, formatDate, formatFigure, hasLessons, reviewText } from "./decisionFormat";

// What is on record about a decision that has been decided: Boss's choice and
// reasons, whether it went with or against Pilot, the expectations written down at
// the time, and (once reviewed) how each one came out and what was learned.
export default function DecisionRecord({
  decision,
  state,
  comparison,
  closeWithinPercent,
  nowMs,
}: {
  decision: Decision;
  state: DecisionState;
  comparison: ExpectationResult[] | null;
  closeWithinPercent: number;
  nowMs: number;
}) {
  const boss = decision.bossDecision;
  if (!boss) return null;
  const follow = followedPilot(decision);
  const review = reviewText(state, decision.reviewDueAt, nowMs);
  const outcome = decision.outcome;

  return (
    <>
      <section className="dj-card dj-card--gold">
        <h2 className="dj-h2">Your decision</h2>
        <p style={{ margin: "0 0 6px", color: "#f5f7ff", fontWeight: 600 }}>{chosenOptionText(decision)}</p>
        <p className="dj-small" style={{ margin: 0 }}>
          {boss.decidedByName} decided on {formatDate(boss.decidedAt)}.{" "}
          {follow === true ? `${FOLLOW_TEXT.followed}.` : follow === false ? `${FOLLOW_TEXT.overrode}. That is recorded, not argued with.` : ""}
        </p>
        {boss.reasoning ? (
          <p className="dj-muted" style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
            {boss.reasoning}
          </p>
        ) : null}
        {review ? (
          <p className="dj-small" style={{ marginTop: 8 }}>
            {review}.
          </p>
        ) : null}

        {!outcome && decision.expectations.length > 0 ? (
          <>
            <h3 className="dj-h3" style={{ marginTop: 12 }}>
              What you expected
            </h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {decision.expectations.map(e => (
                <li key={e.id} className="dj-muted">
                  {e.metric}: {formatFigure(e.expected, e.unit)} <KindTag kind="predicted" /> within {e.horizonDays}{" "}
                  {e.horizonDays === 1 ? "day" : "days"}
                  {e.basis ? ` (based on: ${e.basis})` : ""}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {outcome ? (
        <section className="dj-card dj-card--gold">
          <h2 className="dj-h2">What actually happened</h2>
          <p className="dj-small" style={{ marginTop: 0 }}>
            Recorded by {outcome.recordedByName} on {formatDate(outcome.recordedAt)}.
          </p>
          <ComparisonTable rows={comparison ?? []} closeWithinPercent={closeWithinPercent} />
          {outcome.notes ? (
            <p className="dj-muted" style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>
              {outcome.notes}
            </p>
          ) : null}
          {hasLessons(outcome.lessons) ? (
            <>
              <h3 className="dj-h3" style={{ marginTop: 12 }}>
                What you learned
              </h3>
              {LESSON_FIELDS.filter(f => outcome.lessons[f.key].trim() !== "").map(f => (
                <p key={f.key} className="dj-muted" style={{ margin: "0 0 6px", whiteSpace: "pre-wrap" }}>
                  <strong>{f.label}:</strong> {outcome.lessons[f.key]}
                </p>
              ))}
            </>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
