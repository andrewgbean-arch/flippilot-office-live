import { useState } from "react";
import type { AnalysisKind } from "@/lib/decisionAnalysisApi";
import type { DecisionPanelProps } from "./decisionPanelProps";
import { analysisAvailability, requestAnalysis } from "./analysisCardLogic";
import AnalysisControls from "./AnalysisControls";
import { DevilsAdvocateCard, PilotViewCard } from "./AnalysisResults";

// Pilot's view ("Ask Pilot") and the Devil's Advocate ("Challenge me") for one
// decision (Pilot Brain V8). The page mounts this with the decision and an
// onChange to call with the decision the server returns.
//
// The roadmap rules on this screen:
//  - BOSS DECIDES: it says "Pilot recommends; Boss decides", and neither button
//    is on offer once the decision is decided or reviewed (the answers already
//    given stay visible, because they are part of the record).
//  - It only ever asks the server for an answer to READ; nothing here changes a
//    car, a lead, a price or anything else in the business.
//  - Owners and managers only: the server refuses anyone else with a 403, and
//    this says so plainly.
//  - Confidence is a word with reasons, never a percentage.

export default function AnalysisCard({ decision, onChange }: DecisionPanelProps) {
  const [busy, setBusy] = useState<AnalysisKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const availability = analysisAvailability(decision, Date.now());

  async function run(kind: AnalysisKind) {
    if (busy !== null) return;
    setBusy(kind);
    setError(null);
    const outcome = await requestAnalysis(decision.id, kind);
    setBusy(null);
    if (outcome.ok) {
      onChange(outcome.decision);
      setRemaining(outcome.remaining);
    } else {
      setError(outcome.error);
    }
  }

  return (
    <section aria-label="Pilot's view and the Devil's Advocate" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <AnalysisControls
        busy={busy}
        unavailableReason={availability.available ? null : availability.reason}
        error={error}
        remaining={remaining}
        onRun={kind => void run(kind)}
      />
      {decision.pilotRecommendation && <PilotViewCard decision={decision} view={decision.pilotRecommendation} />}
      {decision.devilsAdvocate && <DevilsAdvocateCard decision={decision} view={decision.devilsAdvocate} />}
    </section>
  );
}
