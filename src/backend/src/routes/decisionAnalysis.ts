import type { Express } from "express";

// Pilot's view and the Devil's Advocate (Pilot Brain V8). Filled in by the
// analysis builder. OWNER OR MANAGER ONLY. Each call costs a model call, so it
// is capped per dealership per day (takeAnalysisAllowance in decisionStore.ts).
//   POST /pilot-brain/decisions/:id/recommend   Pilot's recommendation + reasons + unknowns
//   POST /pilot-brain/decisions/:id/challenge   the Devil's Advocate ("challenge me")
export default function registerDecisionAnalysisRoute(_app: Express): void {
  // intentionally empty until the analysis builder fills it in
}
