import { useId } from "react";
import type { AnalysisKind } from "@/lib/decisionAnalysisApi";

// The two buttons and the status lines under them. Drawn from props alone, so
// every state (ready, thinking, closed, failed, allowance left) can be checked
// without a browser.

const button = { minHeight: 44, flex: "1 1 160px" } as const;

export interface AnalysisControlsProps {
  busy: AnalysisKind | null; // which call is running, if any
  unavailableReason: string | null; // why the buttons are off, or null when they are on offer
  error: string | null;
  remaining: number | null; // today's allowances left after the last call, when known
  onRun: (kind: AnalysisKind) => void;
}

export default function AnalysisControls({ busy, unavailableReason, error, remaining, onRun }: AnalysisControlsProps) {
  const reasonId = useId();
  const disabled = unavailableReason !== null || busy !== null;
  const describedBy = unavailableReason ? reasonId : undefined;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="sn-btn sn-btn--gold" style={button} disabled={disabled} aria-describedby={describedBy} onClick={() => onRun("recommend")}>
          {busy === "recommend" ? "Asking Pilot…" : "Ask Pilot"}
        </button>
        <button type="button" className="sn-btn sn-btn--ghost" style={button} disabled={disabled} aria-describedby={describedBy} onClick={() => onRun("challenge")}>
          {busy === "challenge" ? "Challenging…" : "Challenge me"}
        </button>
      </div>
      <p style={{ color: "#f5f7ff80", fontSize: 12, margin: "8px 0 0" }}>Pilot recommends; Boss decides.</p>
      {unavailableReason && (
        <p id={reasonId} style={{ color: "#f5f7ffb0", fontSize: 13, margin: "6px 0 0" }}>
          {unavailableReason}
        </p>
      )}
      {busy !== null && (
        <p role="status" style={{ color: "#f5f7ffcc", fontSize: 13, margin: "8px 0 0" }}>
          Pilot is thinking. This can take a few seconds.
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: "#ff8080", fontSize: 13, margin: "8px 0 0" }}>
          {error}
        </p>
      )}
      {remaining !== null && busy === null && !error && (
        <p style={{ color: "#f5f7ff80", fontSize: 12, margin: "6px 0 0" }}>
          {remaining} {remaining === 1 ? "ask" : "asks"} left today.
        </p>
      )}
    </div>
  );
}
