// A lead's money details (what the buyer earns, spends, owes in credit, has saved) are written down
// in a finance conversation, so they are for the people who have that conversation: the owner,
// managers, sales and finance. A general account (front desk, valeting) can still see and add a
// lead's name, phone, email, car and notes, but not these.
//
// Leads are saved as one whole list, so keeping the fields out of what a general account is SENT is
// not enough: when it saves the list back, those fields would be missing and the stored ones would
// be wiped. keepStoredLeadFinances puts the stored ones back (and drops anything it sent).

import type { AuthUser } from "./auth";

export const LEAD_FINANCE_FIELDS = ["income", "expenses", "deposit", "creditScore", "savings", "employmentStability", "riskScore"] as const;

type Who = Pick<AuthUser, "role" | "staffRole">;

export function canSeeLeadFinances(user: Who): boolean {
  return user.role === "owner" || user.staffRole === "manager" || user.staffRole === "sales" || user.staffRole === "finance";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function withoutLeadFinances(leads: unknown[]): unknown[] {
  return leads.map(l => {
    if (!isRecord(l)) return l;
    const copy = { ...l };
    for (const f of LEAD_FINANCE_FIELDS) delete copy[f];
    return copy;
  });
}

export function keepStoredLeadFinances(incoming: unknown[], stored: unknown[]): unknown[] {
  const storedById = new Map<string, Record<string, unknown>>();
  for (const s of stored) if (isRecord(s) && typeof s.id === "string") storedById.set(s.id, s);
  return withoutLeadFinances(incoming).map(l => {
    if (!isRecord(l) || typeof l.id !== "string") return l;
    const old = storedById.get(l.id);
    if (!old) return l;
    const copy = { ...l };
    for (const f of LEAD_FINANCE_FIELDS) if (f in old) copy[f] = old[f];
    return copy;
  });
}
