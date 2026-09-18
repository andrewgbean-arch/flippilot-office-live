// Pilot Brain V6 (The Operator) — the first version where Pilot Brain
// can ever cause a real write, and only ever after a real human
// approval. Per the user's own spec: "Pilot Brain Thinks. Pilot Brain
// Prepares. Boss Approves. Pilot Brain Executes." and the Absolute
// Rule: "Pilot Brain must never become fully autonomous."
//
// Real scope decision, made explicit with the user before building:
// this app has NO real email/SMS sending infrastructure anywhere
// (every existing "message a customer" flow — Invoice, Appointment
// confirmation — opens a mailto: link for the DEALER to send
// themselves; there's no SendGrid/Twilio/Postmark, no key for one).
// So this first slice covers two action types that need no new
// vendor and touch only data that already exists safely:
//   - Bookkeeping categorisation (labels an existing real cost record)
//   - Lead follow-up (drafts a message + creates a real task for a
//     human to act on — never sends anything itself)
// Everything else in the V6 spec (Rota Manager, Customer Success,
// Scheduling reminders, real communication sending) stays out of scope
// until a real send provider is set up — a genuine cost/vendor
// decision, not a code task.
//
// Pure functions only — no I/O, no LLM calls. The route
// (operator.ts) reads/writes real tenant data and is the only place
// that calls Claude (once, only to draft a lead follow-up message's
// TEXT — never to decide which leads need one, that's evidence-based
// below).

export interface CostEntry {
  id: string;
  vehicleId: string;
  type: string;
  label?: string;
  category?: string;
  amount: number;
  date: string;
}

export interface Lead {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  vehicleInterest?: string;
  interestedVehicleId?: string;
}

// Real, evidence-based mapping from a cost's own required `type` field
// (a closed enum, see bookkeeping/types.ts) to a sensible category —
// never invented per-record, always the same real rule for the same
// real type. Returns null when there's genuinely no confident mapping
// (better to prepare nothing than to guess).
const TYPE_TO_CATEGORY: Record<string, string> = {
  purchase: "Acquisition",
  transport: "Logistics",
  auction: "Acquisition",
  parts: "Parts",
  labour: "Labour",
  mot: "Compliance",
  tyres: "Recon",
  detailing: "Recon",
  advertising: "Marketing",
  misc: "Miscellaneous",
  recon: "Recon",
};

export function suggestCategoryForCost(cost: CostEntry): string | null {
  if (cost.category && cost.category.trim()) return null; // already categorised — nothing to prepare
  return TYPE_TO_CATEGORY[cost.type] ?? null;
}

export function findCostsNeedingCategorization(costs: CostEntry[]): { cost: CostEntry; suggestedCategory: string }[] {
  const result: { cost: CostEntry; suggestedCategory: string }[] = [];
  for (const cost of costs) {
    const suggested = suggestCategoryForCost(cost);
    if (suggested) result.push({ cost, suggestedCategory: suggested });
  }
  return result;
}

const DAY_MS = 86400000;
function daysSince(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / DAY_MS;
}

const OPEN_LEAD_STATUSES = ["new", "contacted", "viewing_booked", "test_drive", "negotiating"];

// Same real "stale" definition as watcherEngine's uncontacted-lead
// alert (age since creation, since Lead has no per-status timestamp) —
// reused here rather than re-invented, so the Operator prepares
// follow-ups for exactly the leads the Watcher already flagged, not a
// second, different definition of "needs attention".
export function findLeadsNeedingFollowUp(leads: Lead[], now: number): Lead[] {
  return leads.filter(l => {
    if (!OPEN_LEAD_STATUSES.includes(String(l.status ?? "").toLowerCase())) return false;
    return daysSince(l.createdAt, now) >= 1;
  });
}
