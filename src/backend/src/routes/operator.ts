import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection, readTenantDoc, writeTenantDoc } from "../db";
import { requireAuth, requireStaffRole, type AuthUser } from "../auth";
import {
  findCostsNeedingCategorization,
  findLeadsNeedingFollowUp,
  type CostEntry,
  type Lead,
} from "../engines/operatorEngine";
import { callClaude } from "./pilotBrain";

// Pilot Brain V6 (The Operator) — the Action Orchestrator, Approval
// Centre, Workflow Engine, Audit Engine, and Rollback Engine (Modules
// 1, 2, 3, 12, 13) all live here, since they share one real data
// model: a PreparedAction never causes a write until a real human
// approves it (requireStaffRole("manager") — owner or manager only,
// the same conservative "authority is granted, not assumed" default
// as this app's other sensitive writes). Every field the spec's Audit
// Engine asks for (who approved, when, what changed, previous value,
// new value, reason, outcome) lives directly on the action record —
// its own state transitions ARE the audit trail, not a separate log.

const ACTIONS_COLLECTION = "pilotBrainActions";

type ActionType = "bookkeeping_categorize" | "lead_followup";
type ActionStatus = "prepared" | "approved" | "rejected" | "completed" | "rolled_back";

interface BookkeepingCategorizePayload {
  costId: string;
  vehicleId: string;
  currentCategory: string | null;
  suggestedCategory: string;
}

interface LeadFollowupPayload {
  leadId: string;
  leadName: string;
  draftMessage: string;
  taskId?: string; // set once executed, used by rollback to find the real task to remove
}

interface PreparedAction {
  id: string;
  type: ActionType;
  status: ActionStatus;
  title: string;
  description: string;
  reason: string;
  payload: BookkeepingCategorizePayload | LeadFollowupPayload;
  preparedAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  completedAt?: string;
  rolledBackAt?: string;
}

interface BookkeepingDoc {
  costs: CostEntry[];
  purchases: unknown[];
  sales: unknown[];
  transactions: unknown[];
  suppliers: unknown[];
  categories: unknown[];
}

const EMPTY_BOOKKEEPING: BookkeepingDoc = {
  costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [],
};

function authUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

function readActions(dealershipId: string): PreparedAction[] {
  return readTenantCollection<PreparedAction>(dealershipId, ACTIONS_COLLECTION);
}

function writeActions(dealershipId: string, actions: PreparedAction[]) {
  writeTenantCollection(dealershipId, ACTIONS_COLLECTION, actions);
}

function daysSince(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / 86400000;
}

export default function registerOperatorRoute(app: Express) {
  // Module 14 (Operations Dashboard) reads this — every action, every
  // real status, in one list.
  app.get("/pilot-brain/actions", requireAuth, (req, res) => {
    const user = authUser(req);
    const actions = readActions(user.dealershipId).sort((a, b) => b.preparedAt.localeCompare(a.preparedAt));
    res.json({ ok: true, actions });
  });

  // Module 1/3 (Action Orchestrator + Workflow Engine) — scans real
  // current data for work matching known, evidence-based patterns and
  // prepares (never executes) anything not already pending. This is
  // what "Pilot, run today's operations" actually triggers — there's
  // no scheduler in this app, so it runs on real request, not
  // literally in the background.
  app.post("/pilot-brain/actions/prepare", requireAuth, async (req, res) => {
    const user = authUser(req);
    const existing = readActions(user.dealershipId);
    const activeKeys = new Set(
      existing
        .filter(a => a.status === "prepared" || a.status === "completed")
        .map(a => a.type === "bookkeeping_categorize"
          ? `cost:${(a.payload as BookkeepingCategorizePayload).costId}`
          : `lead:${(a.payload as LeadFollowupPayload).leadId}`)
    );

    const now = Date.now();
    const newActions: PreparedAction[] = [];

    // Bookkeeping categorisation — fully deterministic, no LLM call.
    const bookkeeping = readTenantDoc<BookkeepingDoc>(user.dealershipId, "bookkeeping", EMPTY_BOOKKEEPING);
    for (const { cost, suggestedCategory } of findCostsNeedingCategorization(bookkeeping.costs)) {
      if (activeKeys.has(`cost:${cost.id}`)) continue;
      newActions.push({
        id: randomUUID(),
        type: "bookkeeping_categorize",
        status: "prepared",
        title: `Categorise a ${cost.type} cost as "${suggestedCategory}"`,
        description: `£${cost.amount.toLocaleString()} ${cost.type} cost${cost.label ? ` ("${cost.label}")` : ""} has no category set yet.`,
        reason: `Cost type "${cost.type}" maps to "${suggestedCategory}" — a consistent real rule, not a per-record guess.`,
        payload: { costId: cost.id, vehicleId: cost.vehicleId, currentCategory: cost.category ?? null, suggestedCategory },
        preparedAt: new Date(now).toISOString(),
      });
    }

    // Lead follow-up — WHICH leads is fully evidence-based
    // (findLeadsNeedingFollowUp); Claude is only ever asked to draft
    // the message TEXT for a lead the real data already selected.
    const leads = readTenantCollection<Lead>(user.dealershipId, "leads");
    const staleLeads = findLeadsNeedingFollowUp(leads, now).filter(l => !activeKeys.has(`lead:${l.id}`));
    const apiKey = process.env.ANTHROPIC_API_KEY;

    for (const lead of staleLeads.slice(0, 5)) { // capped — real spend per draft, same reasoning as every other Claude call
      let draftMessage = `Hi ${lead.name}, just checking in about your enquiry${lead.vehicleInterest ? ` regarding the ${lead.vehicleInterest}` : ""} — is this still something you're interested in? Happy to answer any questions.`;
      if (apiKey) {
        try {
          draftMessage = await callClaude(
            apiKey,
            `You are drafting a short, genuine follow-up message from a UK used-car dealer to a real lead named ${lead.name}${lead.vehicleInterest ? `, who enquired about a ${lead.vehicleInterest}` : ""}. Friendly, brief, no pressure, no fabricated details about the vehicle or dealership beyond what's given. 2-3 sentences, no subject line, just the message body.`,
            [{ role: "user", content: "Draft the follow-up message." }],
            200
          );
        } catch (err) {
          console.error("prepare lead_followup: Claude draft failed, using fallback text", err);
        }
      }
      newActions.push({
        id: randomUUID(),
        type: "lead_followup",
        status: "prepared",
        title: `Follow up with ${lead.name}`,
        description: `Open ${Math.floor(daysSince(lead.createdAt, now))} day(s) without contact.`,
        reason: `Lead is still in an open status and hasn't moved forward — the same real staleness signal the Watcher already flags.`,
        payload: { leadId: lead.id, leadName: lead.name, draftMessage },
        preparedAt: new Date(now).toISOString(),
      });
    }

    if (newActions.length > 0) {
      writeActions(user.dealershipId, [...existing, ...newActions]);
    }
    res.json({ ok: true, prepared: newActions.length, actions: newActions });
  });

  // Approve — the ONLY place a real write happens, and only after an
  // explicit human action. Never triggered by Pilot Brain itself.
  app.post("/pilot-brain/actions/:id/approve", requireAuth, requireStaffRole("manager"), (req, res) => {
    const user = authUser(req);
    const actions = readActions(user.dealershipId);
    const action = actions.find(a => a.id === req.params.id);
    if (!action) return res.status(404).json({ ok: false, error: "Action not found" });
    if (action.status !== "prepared") {
      return res.status(400).json({ ok: false, error: `This action is already ${action.status}` });
    }

    const now = new Date().toISOString();

    if (action.type === "bookkeeping_categorize") {
      const payload = action.payload as BookkeepingCategorizePayload;
      const bookkeeping = readTenantDoc<BookkeepingDoc>(user.dealershipId, "bookkeeping", EMPTY_BOOKKEEPING);
      const updatedCosts = bookkeeping.costs.map(c =>
        c.id === payload.costId ? { ...c, category: payload.suggestedCategory } : c
      );
      writeTenantDoc(user.dealershipId, "bookkeeping", { ...bookkeeping, costs: updatedCosts });
    } else {
      const payload = action.payload as LeadFollowupPayload;
      const jobs = readTenantCollection<any>(user.dealershipId, "jobs");
      const leads = readTenantCollection<Lead>(user.dealershipId, "leads");
      const lead = leads.find(l => l.id === payload.leadId);
      const newJob = {
        id: randomUUID(),
        title: `Follow up: ${payload.leadName}`,
        notes: `Prepared by Pilot Brain — never sent automatically. Draft message:\n\n${payload.draftMessage}`,
        status: "todo",
        priority: "medium",
        vehicleId: lead?.interestedVehicleId ?? null,
        vehicleLabel: lead?.vehicleInterest ?? null,
        createdAt: now,
        createdByName: "Pilot Brain",
      };
      writeTenantCollection(user.dealershipId, "jobs", [...jobs, newJob]);
      payload.taskId = newJob.id;
    }

    const updated = actions.map(a => a.id === action.id
      ? { ...a, status: "completed" as ActionStatus, reviewedBy: user.id, reviewedByName: user.name, reviewedAt: now, completedAt: now }
      : a
    );
    writeActions(user.dealershipId, updated);
    res.json({ ok: true, action: updated.find(a => a.id === action.id) });
  });

  app.post("/pilot-brain/actions/:id/reject", requireAuth, requireStaffRole("manager"), (req, res) => {
    const user = authUser(req);
    const actions = readActions(user.dealershipId);
    const action = actions.find(a => a.id === req.params.id);
    if (!action) return res.status(404).json({ ok: false, error: "Action not found" });
    if (action.status !== "prepared") {
      return res.status(400).json({ ok: false, error: `This action is already ${action.status}` });
    }
    const now = new Date().toISOString();
    const updated = actions.map(a => a.id === action.id
      ? { ...a, status: "rejected" as ActionStatus, reviewedBy: user.id, reviewedByName: user.name, reviewedAt: now }
      : a
    );
    writeActions(user.dealershipId, updated);
    res.json({ ok: true, action: updated.find(a => a.id === action.id) });
  });

  // Module 13 (Rollback Engine) — genuinely possible for both action
  // types here (restore the old category; delete the created task)
  // since neither ever sends anything that can't be un-done.
  app.post("/pilot-brain/actions/:id/rollback", requireAuth, requireStaffRole("manager"), (req, res) => {
    const user = authUser(req);
    const actions = readActions(user.dealershipId);
    const action = actions.find(a => a.id === req.params.id);
    if (!action) return res.status(404).json({ ok: false, error: "Action not found" });
    if (action.status !== "completed") {
      return res.status(400).json({ ok: false, error: "Only completed actions can be rolled back" });
    }

    if (action.type === "bookkeeping_categorize") {
      const payload = action.payload as BookkeepingCategorizePayload;
      const bookkeeping = readTenantDoc<BookkeepingDoc>(user.dealershipId, "bookkeeping", EMPTY_BOOKKEEPING);
      const updatedCosts = bookkeeping.costs.map(c =>
        c.id === payload.costId ? { ...c, category: payload.currentCategory ?? undefined } : c
      );
      writeTenantDoc(user.dealershipId, "bookkeeping", { ...bookkeeping, costs: updatedCosts });
    } else {
      const payload = action.payload as LeadFollowupPayload;
      if (payload.taskId) {
        const jobs = readTenantCollection<any>(user.dealershipId, "jobs");
        writeTenantCollection(user.dealershipId, "jobs", jobs.filter((j: any) => j.id !== payload.taskId));
      }
    }

    const now = new Date().toISOString();
    const updated = actions.map(a => a.id === action.id ? { ...a, status: "rolled_back" as ActionStatus, rolledBackAt: now } : a);
    writeActions(user.dealershipId, updated);
    res.json({ ok: true, action: updated.find(a => a.id === action.id) });
  });
}
