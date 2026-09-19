import type { Express } from "express";

// The Simulator routes (Pilot Brain V8). Filled in by the simulator builder.
// OWNER OR MANAGER ONLY. A simulation is pure arithmetic on the dealership's own
// records: it must NEVER write to vehicles, leads, bookkeeping or anything else
// (only, when asked, a snapshot onto a decision).
//   POST /pilot-brain/simulator/run                 run a scenario, return the result (saves nothing)
//   POST /pilot-brain/decisions/:id/simulations     run one and attach the snapshot to a decision
export default function registerSimulatorRoute(_app: Express): void {
  // intentionally empty until the simulator builder fills it in
}
