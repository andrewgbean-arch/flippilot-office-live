import type { DecisionSummary } from "@/lib/decisionsApi";
import { StateChip } from "./decisionUi";
import { followText, formatDate, reviewText } from "./decisionFormat";

// The journal, newest first. Each decision is one tap target, so it works with a
// thumb: the question, where it stands, and the few facts that matter at a glance.
export default function DecisionList({
  decisions,
  nowMs,
  onOpen,
}: {
  decisions: DecisionSummary[];
  nowMs: number;
  onOpen: (id: string) => void;
}) {
  if (decisions.length === 0) {
    return (
      <p className="dj-muted" style={{ padding: "8px 0" }}>
        Nothing written down yet. When you are weighing a big call, such as buying more of one type of car or
        cutting the price of aged stock, write it here first. You will be able to see later how it turned out.
      </p>
    );
  }
  return (
    <div>
      {decisions.map(d => {
        const review = reviewText(d.state, d.reviewDueAt, nowMs);
        const follow = followText(d.followedPilot);
        return (
          <button key={d.id} type="button" className="dj-card dj-list-item" onClick={() => onOpen(d.id)}>
            <span style={{ display: "block", fontWeight: 600, color: "#f5f7ff", marginBottom: 6 }}>{d.question}</span>
            <span className="dj-chips">
              <StateChip state={d.state} />
              {d.hasRecommendation ? <span className="dj-chip dj-chip--plain">Pilot advised</span> : null}
              {d.hasChallenge ? <span className="dj-chip dj-chip--plain">Challenged</span> : null}
              {d.simulationCount > 0 ? (
                <span className="dj-chip dj-chip--plain">
                  {d.simulationCount} {d.simulationCount === 1 ? "simulation" : "simulations"}
                </span>
              ) : null}
              {follow ? <span className="dj-chip dj-chip--plain">{follow}</span> : null}
            </span>
            <span className="dj-small" style={{ display: "block", marginTop: 6 }}>
              {d.chosenOption ? <>You chose: {d.chosenOption}. </> : null}
              {d.decidedAt ? <>Decided {formatDate(d.decidedAt)}. </> : <>Written {formatDate(d.createdAt)}. </>}
              {review}
            </span>
          </button>
        );
      })}
    </div>
  );
}
