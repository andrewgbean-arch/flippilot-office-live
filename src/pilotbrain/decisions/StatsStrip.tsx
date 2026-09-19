import type { JournalStats } from "@/lib/decisionsApi";
import { KindTag } from "./decisionUi";
import { CLOSE_WITHIN_PERCENT, MIN_REVIEWED_FOR_RATES, TOO_FEW_REVIEWED_MESSAGE } from "./decisionFormat";

// How the decision journal is going, at the top of the page. Four counts from the
// journal itself, then either an honest sentence about how expectations have held
// up or, until three decisions have been reviewed, a plain "too few" message: never
// a percentage from a tiny sample. The sentence comes from the server, so the
// screen cannot say more than the rules allow.
function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className="dj-stat__value" style={highlight && value > 0 ? { color: "#ffb08a" } : undefined}>
        {value}
      </div>
      <div className="dj-stat__label">
        {label}
        <KindTag kind="known" />
      </div>
    </div>
  );
}

export default function StatsStrip({ stats }: { stats: JournalStats }) {
  const need = stats.minReviewedForRates ?? MIN_REVIEWED_FOR_RATES;
  const within = stats.closeWithinPercent ?? CLOSE_WITHIN_PERCENT;
  const groupLine = (label: string, group: JournalStats["followedGroup"]) =>
    group.reviewedDecisions >= need ? (
      <p className="dj-muted" style={{ margin: "6px 0 0" }}>{group.sentence}</p>
    ) : (
      <p className="dj-muted" style={{ margin: "6px 0 0" }}>
        <strong>{label}:</strong> {group.sentence || TOO_FEW_REVIEWED_MESSAGE}
      </p>
    );

  return (
    <section className="dj-card" aria-label="How your decisions are going">
      <div className="dj-stats">
        <Stat label="Open" value={stats.counts.open} />
        <Stat label="Review due" value={stats.counts.review_due} highlight />
        <Stat label="Followed Pilot" value={stats.followedPilot} />
        <Stat label="Overrode Pilot" value={stats.overrodePilot} />
      </div>

      <p className="dj-muted" style={{ margin: 0 }}>
        {stats.summary}
        {stats.enoughReviewed ? <KindTag kind="inferred" /> : null}
      </p>
      {stats.enoughReviewed ? (
        <>
          {groupLine("When you followed Pilot", stats.followedGroup)}
          {groupLine("When you overrode Pilot", stats.overrodeGroup)}
        </>
      ) : (
        <p className="dj-small" style={{ margin: "4px 0 0" }}>
          Pilot only says how well expectations are holding up once {need} decisions have been reviewed.
        </p>
      )}
      <p className="dj-small" style={{ margin: "8px 0 0" }}>
        Close means within {within}% of what you expected. These are counts of your own decisions, not a forecast.
      </p>
    </section>
  );
}
