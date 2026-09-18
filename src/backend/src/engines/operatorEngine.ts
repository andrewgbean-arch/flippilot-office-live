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
// Later extended with two more action types, once the user explicitly
// scoped it ("safe areas first" — same risk tier as the two above, not
// Finance/Billing/contracts): Rota (suggest a real shift for a real
// open-day gap) and Appointments (draft a follow-up for an overdue
// pending booking, same "draft + real task, never send" shape as
// leads). Everything needing real communication sending, or touching
// money/legal commitments, stays out of scope for the same reason as
// before.
//
// Pure functions only — no I/O, no LLM calls. The route
// (operator.ts) reads/writes real tenant data and is the only place
// that calls Claude (only ever to draft message TEXT for a target the
// real data already selected — never to decide which targets need one,
// that's evidence-based below).

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

export interface ShiftLike {
  userId: string;
  userName: string;
  date: string; // yyyy-mm-dd
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export interface WorkPatternLike {
  userId: string;
  userName: string;
  availableDays: string[]; // WeekDay values: mon/tue/wed/thu/fri/sat/sun
}

export interface LeaveLike {
  userId: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface RotaSettingsLike {
  openDays: string[];
  openTime: string;
  closeTime: string;
}

export interface RotaGap {
  date: string;
  userId: string;
  userName: string;
  start: string;
  end: string;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function toDateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEKDAY_BY_GETDAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function isOnApprovedLeave(date: string, leave: LeaveLike[], userId: string): boolean {
  return leave.some(l => l.userId === userId && l.status === "approved" && l.startDate <= date && date <= l.endDate);
}

// Real gap definition, deliberately the simplest defensible one: an
// open day (per real RotaSettings) with ZERO shifts scheduled at all.
// There's no "role" or "minimum coverage" concept anywhere in this
// app's real rota data, so anything fancier than "nobody at all is
// rostered" would be inventing a staffing policy rather than reading
// one. Only looks forward (tomorrow onward, not today — nothing
// actionable about a gap that's already started) across a real
// near-term window, same reasoning as every other "next N days" signal
// in this app rather than guessing further ahead.
export function findRotaGaps(
  shifts: ShiftLike[],
  patterns: WorkPatternLike[],
  leave: LeaveLike[],
  settings: RotaSettingsLike,
  now: number,
  windowDays = 7
): RotaGap[] {
  const gaps: RotaGap[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i <= windowDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const date = toDateKeyLocal(d);
    const day = WEEKDAY_BY_GETDAY[d.getDay()]!;

    if (!settings.openDays.includes(day)) continue;
    if (shifts.some(s => s.date === date)) continue; // already covered — not a gap

    const eligible = patterns.filter(
      p => p.availableDays.includes(day) && !isOnApprovedLeave(date, leave, p.userId)
    );
    if (eligible.length === 0) continue; // no real candidate — don't fabricate one

    // Whoever has the least time already scheduled across this same
    // real window is suggested first — a real signal for who's most
    // free, not an arbitrary pick.
    const scheduledMinutes = (userId: string) =>
      shifts
        .filter(s => s.userId === userId)
        .reduce((sum, s) => sum + Math.max(0, toMinutes(s.end) - toMinutes(s.start)), 0);

    const candidate = [...eligible].sort((a, b) => scheduledMinutes(a.userId) - scheduledMinutes(b.userId))[0];
    if (!candidate) continue;

    gaps.push({ date, userId: candidate.userId, userName: candidate.userName, start: settings.openTime, end: settings.closeTime });
  }

  return gaps;
}

export interface AppointmentLike {
  id: string;
  customerName: string;
  type: string;
  requestedDate: string;
  requestedTime: string;
  status: string;
}

// Exact same real staleness signal as watcherEngine's "Appointment
// never reviewed" alert (status still pending, requested date/time
// already passed) — reused rather than re-invented, same reasoning as
// findLeadsNeedingFollowUp below.
export function findOverdueAppointments(appointments: AppointmentLike[], now: number): AppointmentLike[] {
  return appointments.filter(a => {
    if (a.status !== "pending") return false;
    const requested = new Date(`${a.requestedDate}T${a.requestedTime ?? "00:00"}`).getTime();
    if (Number.isNaN(requested)) return false;
    return requested < now;
  });
}

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
