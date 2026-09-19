import type { ExpectationResult } from "@/lib/decisionsApi";
import { differenceText, formatFigure } from "./decisionFormat";
import { KindTag, VerdictChip } from "./decisionUi";

// Each expectation beside what happened, with a chip that says whether it came out
// close. Every number says what kind it is: the expectation was PREDICTED, the
// result is KNOWN (or UNKNOWN, shown as "Unknown", never as 0), and the difference
// is INFERRED (worked out from the two). Close means within `closeWithinPercent`.
// On a phone each row becomes its own card (see decisions.css).
export default function ComparisonTable({ rows, closeWithinPercent }: { rows: ExpectationResult[]; closeWithinPercent: number }) {
  if (rows.length === 0) {
    return <p className="dj-small">No expectations were set for this decision, so there is nothing to compare.</p>;
  }
  return (
    <div>
      <table className="dj-table">
        <thead>
          <tr>
            <th scope="col">What you measured</th>
            <th scope="col">You expected</th>
            <th scope="col">What happened</th>
            <th scope="col">Difference</th>
            <th scope="col">How it came out</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.expectationId}>
              <td data-label="What you measured">
                <strong>{r.metric}</strong>
                <span className="dj-small" style={{ display: "block" }}>
                  within {r.horizonDays} {r.horizonDays === 1 ? "day" : "days"}
                </span>
                {r.basis ? <span className="dj-small" style={{ display: "block" }}>Based on: {r.basis}</span> : null}
              </td>
              <td data-label="You expected">
                {formatFigure(r.expected, r.unit)}
                <KindTag kind="predicted" />
              </td>
              <td data-label="What happened">
                {formatFigure(r.actual, r.unit)}
                <KindTag kind={r.actual === null ? "unknown" : "known"} />
                {r.note ? <span className="dj-small" style={{ display: "block" }}>{r.note}</span> : null}
              </td>
              <td data-label="Difference">
                {differenceText(r)}
                {r.verdict === "unknown" ? <KindTag kind="unknown" /> : <KindTag kind="inferred" />}
              </td>
              <td data-label="How it came out">
                <VerdictChip verdict={r.verdict} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dj-small" style={{ marginTop: 8 }}>
        Close means within {closeWithinPercent}% of what you expected. Above and below say which way the number went, not whether that was good.
      </p>
    </div>
  );
}
