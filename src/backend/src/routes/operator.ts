import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection, readTenantDoc, writeTenantDoc } from "../db";
import { requireAuth, requireStaffRole, type AuthUser } from "../auth";
import {
  findCostsNeedingCategorization,
  findLeadsNeedingFollowUp,
  findRotaGaps,
  findOverdueAppointments,
  type CostEntry,
  type Lead,
} from "../engines/operatorEngine";
import { PREPARED_ACTIONS_COLLECTION } from "../engines/preparedActions";
import { oneLine } from "../engines/promptText";
import { changeRecord, type RecordUpdatePayload } from "../pilotBrainEdits";
import { tenantRecordStore } from "../pilotBrainTools";
import { callClaude } from "./pilotBrain";
import { DEFAULT_ROTA_SETTINGS, type Shift, type WorkPattern, type LeaveRequest, type RotaSettings } from "./planner";
import type { Appointment } from "./publicBooking";
import { formatPounds } from "../money";

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

const ACTIONS_COLLECTION = PREPARED_ACTIONS_COLLECTION;

type ActionType = "bookkeeping_categorize" | "lead_followup" | "rota_shift" | "appointment_followup" | "record_update";
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

interface RotaShiftPayload {
  date: string;
  userId: string;
  userName: string;
  start: string;
  end: string;
  shiftId?: string; // set once executed, used by rollback to find the real shift to remove
}

interface AppointmentFollowupPayload {
  appointmentId: string;
  customerName: string;
  draftMessage: string;
  taskId?: string; // same rollback pattern as LeadFollowupPayload
}

type ActionPayload = BookkeepingCategorizePayload | LeadFollowupPayload | RotaShiftPayload | AppointmentFollowupPayload | RecordUpdatePayload;

interface PreparedAction {
  id: string;
  type: ActionType;
  status: ActionStatus;
  title: string;
  description: string;
  reason: string;
  payload: ActionPayload;
  preparedAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  completedAt?: string;
  rolledBackAt?: string;
}

// One dedupe key per real target, prefixed by type so different action
// types can never collide — prepare uses this to never re-prepare
// something already pending or done for the same real target.
function actionKey(a: PreparedAction): string {
  switch (a.type) {
    case "bookkeeping_categorize": return `cost:${(a.payload as BookkeepingCategorizePayload).costId}`;
    case "lead_followup": return `lead:${(a.payload as LeadFollowupPayload).leadId}`;
    case "rota_shift": return `shift-gap:${(a.payload as RotaShiftPayload).date}`;
    case "appointment_followup": return `appointment:${(a.payload as AppointmentFollowupPayload).appointmentId}`;
    case "record_update": {
      const p = a.payload as RecordUpdatePayload;
      return `edit:${p.kind}:${p.recordId}:${p.field}`;
    }
  }
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
      existing.filter(a => a.status === "prepared" || a.status === "completed").map(actionKey)
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
        // A stored cost can lack a usable amount (an old record, a raw API call); say so
        // plainly instead of throwing, which used to end the whole server process.
        description: `${typeof cost.amount === "number" && Number.isFinite(cost.amount) ? `${formatPounds(cost.amount)} ` : "A "}${cost.type} cost${cost.label ? ` ("${cost.label}")` : ""} has no category set yet.`,
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
            `You are drafting a short, genuine follow-up message from a UK used-car dealer to a real lead named ${oneLine(lead.name, 60)}${lead.vehicleInterest ? `, who enquired about a ${oneLine(lead.vehicleInterest, 80)}` : ""}. Friendly, brief, no pressure, no fabricated details about the vehicle or dealership beyond what's given. 2-3 sentences, no subject line, just the message body.`,
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

    // Rota gaps — fully deterministic, no LLM call. Real gap definition:
    // an open day with zero shifts scheduled at all; candidate is
    // whoever's available, not on approved leave, and least already
    // committed over the same window (see findRotaGaps).
    const shifts = readTenantCollection<Shift>(user.dealershipId, "shifts");
    const workPatterns = readTenantCollection<WorkPattern>(user.dealershipId, "workPatterns");
    const leaveRequests = readTenantCollection<LeaveRequest>(user.dealershipId, "leave");
    const rotaSettings = readTenantDoc<RotaSettings>(user.dealershipId, "rotaSettings", DEFAULT_ROTA_SETTINGS);

    for (const gap of findRotaGaps(shifts, workPatterns, leaveRequests, rotaSettings, now)) {
      if (activeKeys.has(`shift-gap:${gap.date}`)) continue;
      newActions.push({
        id: randomUUID(),
        type: "rota_shift",
        status: "prepared",
        title: `Cover ${gap.date} with ${gap.userName}`,
        description: `${gap.date} is an open day with no shifts scheduled at all yet.`,
        reason: `${gap.userName} is available that day per their real work pattern, not on approved leave, and currently has the least time scheduled over the next 7 days of anyone eligible.`,
        payload: { date: gap.date, userId: gap.userId, userName: gap.userName, start: gap.start, end: gap.end },
        preparedAt: new Date(now).toISOString(),
      });
    }

    // Overdue appointments — WHICH ones is fully evidence-based
    // (findOverdueAppointments, the exact same signal the Watcher
    // already flags); Claude is only ever asked to draft the message
    // TEXT for an appointment the real data already selected.
    const appointments = readTenantCollection<Appointment>(user.dealershipId, "appointments");
    const overdueAppointments = findOverdueAppointments(appointments, now).filter(
      a => !activeKeys.has(`appointment:${a.id}`)
    );

    for (const appt of overdueAppointments.slice(0, 5)) { // capped — same reasoning as the lead loop above
      const kindLabel = appt.type.replace("_", " ");
      let apptDraftMessage = `Hi ${appt.customerName}, sorry for the delay — following up on your ${kindLabel} request for ${appt.requestedDate}. Is this still something you'd like to arrange? Let us know a time that works and we'll get it booked in.`;
      if (apiKey) {
        try {
          apptDraftMessage = await callClaude(
            apiKey,
            `You are drafting a short, genuine follow-up message from a UK used-car dealer to ${oneLine(appt.customerName, 60)}, whose ${kindLabel} request for ${oneLine(appt.requestedDate, 12)} was never confirmed, declined, or marked complete. Friendly, apologetic for the delay, brief, no pressure, no fabricated details beyond what's given. 2-3 sentences, no subject line, just the message body.`,
            [{ role: "user", content: "Draft the follow-up message." }],
            200
          );
        } catch (err) {
          console.error("prepare appointment_followup: Claude draft failed, using fallback text", err);
        }
      }
      newActions.push({
        id: randomUUID(),
        type: "appointment_followup",
        status: "prepared",
        title: `Follow up on ${appt.customerName}'s overdue appointment`,
        description: `${kindLabel} request for ${appt.requestedDate} at ${appt.requestedTime} was never confirmed, declined, or marked complete.`,
        reason: `Same real staleness signal the Watcher already flags — a pending appointment whose requested time has already passed.`,
        payload: { appointmentId: appt.id, customerName: appt.customerName, draftMessage: apptDraftMessage },
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

    switch (action.type) {
      case "bookkeeping_categorize": {
        const payload = action.payload as BookkeepingCategorizePayload;
        const bookkeeping = readTenantDoc<BookkeepingDoc>(user.dealershipId, "bookkeeping", EMPTY_BOOKKEEPING);
        const updatedCosts = bookkeeping.costs.map(c =>
          c.id === payload.costId ? { ...c, category: payload.suggestedCategory } : c
        );
        writeTenantDoc(user.dealershipId, "bookkeeping", { ...bookkeeping, costs: updatedCosts });
        break;
      }
      case "lead_followup": {
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
        break;
      }
      case "rota_shift": {
        const payload = action.payload as RotaShiftPayload;
        const shifts = readTenantCollection<Shift>(user.dealershipId, "shifts");
        const newShift: Shift = {
          id: randomUUID(),
          userId: payload.userId,
          userName: payload.userName,
          date: payload.date,
          start: payload.start,
          end: payload.end,
          notes: "Prepared by Pilot Brain — never sent automatically.",
          autoGenerated: false,
          createdAt: now,
        };
        writeTenantCollection(user.dealershipId, "shifts", [...shifts, newShift]);
        payload.shiftId = newShift.id;
        break;
      }
      case "appointment_followup": {
        const payload = action.payload as AppointmentFollowupPayload;
        const jobs = readTenantCollection<any>(user.dealershipId, "jobs");
        const newJob = {
          id: randomUUID(),
          title: `Follow up: ${payload.customerName} (overdue appointment)`,
          notes: `Prepared by Pilot Brain — never sent automatically. Draft message:\n\n${payload.draftMessage}`,
          status: "todo",
          priority: "medium",
          vehicleId: null,
          vehicleLabel: null,
          createdAt: now,
          createdByName: "Pilot Brain",
        };
        writeTenantCollection(user.dealershipId, "jobs", [...jobs, newJob]);
        payload.taskId = newJob.id;
        break;
      }
      case "record_update": {
        // Refuses (and leaves the change waiting) if someone has edited the
        // record since it was prepared, rather than overwriting their work.
        const result = changeRecord(tenantRecordStore(user.dealershipId), action.payload as RecordUpdatePayload, "apply", now);
        if (!result.ok) return res.status(result.conflict ? 409 : 400).json({ ok: false, error: result.error });
        break;
      }
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

    switch (action.type) {
      case "bookkeeping_categorize": {
        const payload = action.payload as BookkeepingCategorizePayload;
        const bookkeeping = readTenantDoc<BookkeepingDoc>(user.dealershipId, "bookkeeping", EMPTY_BOOKKEEPING);
        const updatedCosts = bookkeeping.costs.map(c =>
          c.id === payload.costId ? { ...c, category: payload.currentCategory ?? undefined } : c
        );
        writeTenantDoc(user.dealershipId, "bookkeeping", { ...bookkeeping, costs: updatedCosts });
        break;
      }
      case "lead_followup":
      case "appointment_followup": {
        const payload = action.payload as LeadFollowupPayload | AppointmentFollowupPayload;
        if (payload.taskId) {
          const jobs = readTenantCollection<any>(user.dealershipId, "jobs");
          writeTenantCollection(user.dealershipId, "jobs", jobs.filter((j: any) => j.id !== payload.taskId));
        }
        break;
      }
      case "rota_shift": {
        const payload = action.payload as RotaShiftPayload;
        if (payload.shiftId) {
          const shifts = readTenantCollection<Shift>(user.dealershipId, "shifts");
          writeTenantCollection(user.dealershipId, "shifts", shifts.filter(s => s.id !== payload.shiftId));
        }
        break;
      }
      case "record_update": {
        // Puts the old value back, but only if nobody has changed it again.
        const result = changeRecord(tenantRecordStore(user.dealershipId), action.payload as RecordUpdatePayload, "revert", new Date().toISOString());
        if (!result.ok) return res.status(result.conflict ? 409 : 400).json({ ok: false, error: result.error });
        break;
      }
    }

    const now = new Date().toISOString();
    const updated = actions.map(a => a.id === action.id ? { ...a, status: "rolled_back" as ActionStatus, rolledBackAt: now } : a);
    writeActions(user.dealershipId, updated);
    res.json({ ok: true, action: updated.find(a => a.id === action.id) });
  });
}
