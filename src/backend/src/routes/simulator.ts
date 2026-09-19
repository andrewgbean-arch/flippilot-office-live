import type { Express, Request } from "express";
import { randomUUID } from "crypto";
import { readTenantCollection, readTenantDoc } from "../db";
import { requireAuth, requireStaffRole, type AuthUser } from "../auth";
import { MAX_SIMULATIONS, decisionState, parseConfidence, type SimulationSnapshot } from "../decisionTypes";
import { mutateDecision } from "../decisionStore";
import { parseSimulationRequest, runSimulation, type SimulationInputs } from "../engines/simulator";

// The Simulator routes (Pilot Brain V8). OWNER OR MANAGER ONLY.
//
// A simulation is pure arithmetic on the dealership's own records plus the
// assumptions printed next to the answer. Boss decides: these routes only READ
// vehicles, leads and the Bookkeeping ledger, and the only thing ever written is
// a snapshot on a DECISION record (through mutateDecision, so an event is added).
//   POST /pilot-brain/simulator/run                 run a scenario, return the result (saves nothing)
//   POST /pilot-brain/decisions/:id/simulations     run one and attach the snapshot to a decision
//
// The attach route runs the simulation itself, from the numbers Boss typed. It
// never takes a result from the request: anything sent alongside the numbers
// (a "snapshot", a "confidence") is ignored.

function authUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// Everything the engine reads, straight from this dealership's own storage.
function readInputs(dealershipId: string, now: number): SimulationInputs {
  return {
    vehicles: readTenantCollection<unknown>(dealershipId, "vehicles"),
    leads: readTenantCollection<unknown>(dealershipId, "leads"),
    bookkeeping: readTenantDoc<unknown>(dealershipId, "bookkeeping", {}),
    now,
  };
}

export default function registerSimulatorRoute(app: Express): void {
  app.post("/pilot-brain/simulator/run", requireAuth, requireStaffRole("manager"), (req, res) => {
    const parsed = parseSimulationRequest(req.body);
    if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });

    const simulation = runSimulation(readInputs(authUser(req).dealershipId, Date.now()), parsed.request);
    return res.json({ ok: true, simulation });
  });

  app.post("/pilot-brain/decisions/:id/simulations", requireAuth, requireStaffRole("manager"), (req, res) => {
    const user = authUser(req);
    const decisionId = req.params.id;
    if (!decisionId) return res.status(404).json({ ok: false, error: "That decision wasn't found." });
    const parsed = parseSimulationRequest(req.body);
    if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });

    // The work is done BEFORE the decision is touched (decisionStore's rule: no
    // slow work inside the change), and from the numbers only: never from a
    // snapshot the client sent.
    const now = Date.now();
    const snapshot: SimulationSnapshot = { id: randomUUID(), ...runSimulation(readInputs(user.dealershipId, now), parsed.request) };
    if (parseConfidence(snapshot.confidence) === null) {
      return res.status(500).json({ ok: false, error: "That simulation could not be worked out. Please try again." });
    }

    const result = mutateDecision(
      user.dealershipId,
      decisionId,
      { id: user.id, name: user.name },
      "simulation",
      draft => {
        if (decisionState(draft, now) !== "open") {
          return "This decision has already been made, so its simulations can't be changed. You can still run a simulation without saving it.";
        }
        if (draft.simulations.length >= MAX_SIMULATIONS) {
          return `A decision can hold at most ${MAX_SIMULATIONS} simulations. Run one without saving it, or start a new decision.`;
        }
        draft.simulations.push(snapshot);
      },
      `Simulation added: ${snapshot.title}`,
      new Date(now).toISOString()
    );
    if (!result.ok) return res.status(result.notFound ? 404 : 409).json({ ok: false, error: result.error });
    return res.status(201).json({ ok: true, decision: result.decision, simulation: snapshot });
  });
}
