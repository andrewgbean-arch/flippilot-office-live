import type { DecisionEvent } from "@/lib/decisionTypes";
import { EVENT_LABEL, formatDateTime } from "./decisionFormat";

// Everything that has happened to a decision, oldest first, so "why did we do this?"
// can still be answered months later. Folded away until asked for. Notes and names
// are text people wrote, so they are only ever shown as plain text.
export default function AuditTrail({ events }: { events: DecisionEvent[] }) {
  return (
    <details className="dj-card dj-audit">
      <summary>
        Audit trail ({events.length} {events.length === 1 ? "event" : "events"})
      </summary>
      <ol>
        {events.map((e, i) => (
          <li key={i}>
            <strong style={{ color: "#f5f7ff" }}>{EVENT_LABEL[e.action] ?? e.action}</strong>
            <span className="dj-small" style={{ display: "block" }}>
              {formatDateTime(e.at)} by {e.byName}
            </span>
            {e.note ? <span style={{ display: "block", marginTop: 2 }}>{e.note}</span> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
