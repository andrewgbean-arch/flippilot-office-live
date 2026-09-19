import type { Express } from "express";

// The Decision Journal routes (Pilot Brain V8). Filled in by the journal
// builder. The contract, all under /pilot-brain/decisions, all OWNER OR MANAGER
// ONLY (requireAuth + requireStaffRole("manager")); the /pilot-brain prefix is
// already gated for the subscription and the Pilot Brain add-on in app.ts:
//   GET    /pilot-brain/decisions            list summaries + learning-loop stats
//   POST   /pilot-brain/decisions            create {question, context, options[]}
//   GET    /pilot-brain/decisions/:id        one full decision
//   PUT    /pilot-brain/decisions/:id        edit question/context/options while still open
//   PUT    /pilot-brain/decisions/:id/decide     Boss's choice + reasoning + expectations
//   PUT    /pilot-brain/decisions/:id/outcome    the actual results + lessons
// State machine: open -> decided -> reviewed, never backwards. See decisionStore.ts
// for the safe read-modify-write helpers to use, and decisionTypes.ts for the limits.
export default function registerDecisionsRoute(_app: Express): void {
  // intentionally empty until the journal builder fills it in
}
