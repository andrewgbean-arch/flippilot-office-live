import type { Decision } from "@/lib/decisionTypes";

// What the Decisions page hands to each of its panels. A panel that changes the
// decision (a new simulation attached, a recommendation or challenge saved) calls
// onChange with the updated decision the server returned, so the page stays in step.
export interface DecisionPanelProps {
  decision: Decision;
  onChange: (next: Decision) => void;
}
