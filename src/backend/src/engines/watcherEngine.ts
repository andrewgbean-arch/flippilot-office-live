// Pilot Brain V2 (Watcher) — Business Health, Monitoring, Alert, Risk
// Detection and Activity Analyzer engines, per the user's own V2 spec.
// Pure functions, no I/O — the route (pilotBrain.ts) reads tenant data
// in and persists alerts as real notifications out.
//
// Real constraint that still shapes one choice below: Lead has no
// per-status-change timestamp (only createdAt), so "time since last
// contact" is honestly approximated as "time since this lead was
// created, if it's still open" rather than inventing a field that
// doesn't exist. (Sales Health USED to be a Lead-status proxy because
// bookkeeping was believed to be localStorage-only — that was wrong,
// see project memory correction; it now reads real sales data below.)

export type Severity = "info" | "warning" | "critical";

export interface WatcherAlert {
  severity: Severity;
  category: "lead" | "inventory" | "appointment" | "activity";
  title: string;
  message: string;
  // Stable per-record key so the route can dedupe against an
  // already-sent notification instead of re-alerting every time this
  // runs (there's no scheduler in this app — this runs on-demand,
  // whenever a dealer loads the dashboard or Pilot Brain).
  sourceKey: string;
}

export interface BusinessHealth {
  overall: number;
  salesHealth: number;
  leadHealth: number;
  inventoryHealth: number;
  activityHealth: number;
}

export interface RiskFlag {
  title: string;
  message: string;
}

export interface ActivitySummary {
  leadsAddedLast7Days: number;
  appointmentsBookedLast7Days: number;
  tasksCompletedLast7Days: number;
  leadsWonTotal: number;
}

export interface WatcherResult {
  health: BusinessHealth;
  alerts: WatcherAlert[];
  risks: RiskFlag[];
  activity: ActivitySummary;
}

const OPEN_LEAD_STATUSES = ["new", "contacted", "viewing_booked", "test_drive", "negotiating"];

function daysSince(iso: string | undefined | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (now - t) / 86400000;
}

export function runWatcher(
  vehicles: any[],
  leads: any[],
  appointments: any[],
  jobs: any[],
  sales: { vehicleId: string; salePrice: number; date: string }[] = []
): WatcherResult {
  const now = Date.now();
  const inStock = vehicles.filter(v => String(v.status ?? "").toLowerCase() !== "sold");
  const openLeads = leads.filter(l => OPEN_LEAD_STATUSES.includes(String(l.status ?? "").toLowerCase()));
  const wonLeads = leads.filter(l => String(l.status ?? "").toLowerCase() === "won");

  const alerts: WatcherAlert[] = [];

  // ---- Monitoring + Alert Engine: uncontacted / stale leads ----
  for (const lead of openLeads) {
    const age = daysSince(lead.createdAt, now);
    if (age == null) continue;

    const interestedVehicle = lead.interestedVehicleId
      ? vehicles.find(v => v.id === lead.interestedVehicleId)
      : null;
    // £20k is a rough mid-fleet cutover for "high value" on a typical
    // independent used-car dealer's stock — a heuristic, not a config
    // value yet.
    const highValue = (interestedVehicle?.priceRetail ?? 0) >= 20000;

    if (String(lead.status).toLowerCase() === "new" && age >= 1) {
      alerts.push({
        severity: highValue && age >= 3 ? "critical" : "warning",
        category: "lead",
        title: highValue ? "High-value enquiry not followed up" : "Lead not contacted",
        message: `${lead.name} enquired ${Math.floor(age)} day${Math.floor(age) === 1 ? "" : "s"} ago and hasn't been contacted yet.`,
        sourceKey: `lead:uncontacted:${lead.id}`,
      });
    } else if (age >= 14) {
      alerts.push({
        severity: "critical",
        category: "lead",
        title: "Lead at high risk of going cold",
        message: `${lead.name} has been open ${Math.floor(age)} days without reaching a decision.`,
        sourceKey: `lead:stale:${lead.id}`,
      });
    } else if (age >= 7) {
      alerts.push({
        severity: "warning",
        category: "lead",
        title: "Lead needs a follow-up",
        message: `${lead.name} has been open ${Math.floor(age)} days without reaching a decision.`,
        sourceKey: `lead:stale:${lead.id}`,
      });
    }
  }

  // ---- Aging inventory ----
  // Only vehicles with a real createdAt are checked — older/seed
  // records predate that field, and guessing an age for them would be
  // fabricating data (see project memory on Vehicle.createdAt).
  const agingVehicles = inStock.filter(v => (daysSince(v.createdAt, now) ?? -1) >= 60);
  for (const v of agingVehicles) {
    const age = daysSince(v.createdAt, now)!;
    alerts.push({
      severity: age >= 120 ? "critical" : "warning",
      category: "inventory",
      title: age >= 120 ? "Vehicle aging heavily in stock" : "Vehicle approaching stock age target",
      message: `${v.make} ${v.model} has been in stock for ${Math.floor(age)} days.`,
      sourceKey: `vehicle:aging:${v.id}`,
    });
  }

  // ---- Incomplete appointments: date has passed, staff never acted ----
  for (const a of appointments) {
    if (a.status !== "pending") continue;
    const requested = new Date(`${a.requestedDate}T${a.requestedTime ?? "00:00"}`).getTime();
    if (Number.isNaN(requested) || requested >= now) continue;
    alerts.push({
      severity: "warning",
      category: "appointment",
      title: "Appointment never reviewed",
      message: `${a.customerName}'s ${String(a.type).replace("_", " ")} on ${a.requestedDate} was never confirmed, declined, or marked complete.`,
      sourceKey: `appointment:incomplete:${a.id}`,
    });
  }

  // ---- Activity Analyzer ----
  const leadsAddedLast7Days = leads.filter(l => (daysSince(l.createdAt, now) ?? 999) <= 7).length;
  const appointmentsBookedLast7Days = appointments.filter(a => (daysSince(a.createdAt, now) ?? 999) <= 7).length;
  const tasksCompletedLast7Days = jobs.filter(j => (daysSince(j.completedAt, now) ?? 999) <= 7).length;

  const activity: ActivitySummary = {
    leadsAddedLast7Days,
    appointmentsBookedLast7Days,
    tasksCompletedLast7Days,
    leadsWonTotal: wonLeads.length,
  };

  const recentActivityCount = leadsAddedLast7Days + appointmentsBookedLast7Days + tasksCompletedLast7Days;
  if (recentActivityCount === 0 && (leads.length > 0 || vehicles.length > 0)) {
    alerts.push({
      severity: "info",
      category: "activity",
      title: "No recent business activity",
      message: "No new leads, appointments, or completed tasks logged in the last 7 days.",
      // Dated so this re-alerts at most once/day rather than never again
      // once the dealer's dismissed/seen one "quiet week" notice.
      sourceKey: `activity:quiet:${new Date(now).toISOString().slice(0, 10)}`,
    });
  }

  // ---- Risk Detection Engine: this week vs the week before ----
  const risks: RiskFlag[] = [];

  const leadsPrevWeek = leads.filter(l => {
    const d = daysSince(l.createdAt, now);
    return d != null && d > 7 && d <= 14;
  }).length;
  if (leadsPrevWeek >= 3 && leadsAddedLast7Days <= leadsPrevWeek * 0.7) {
    risks.push({
      title: "Enquiry volume dropping",
      message: `${leadsAddedLast7Days} new leads this week vs ${leadsPrevWeek} the week before.`,
    });
  }

  if (openLeads.length >= 5) {
    const staleOpenLeads = openLeads.filter(l => (daysSince(l.createdAt, now) ?? 0) >= 7).length;
    const staleRatio = staleOpenLeads / openLeads.length;
    if (staleRatio >= 0.4) {
      risks.push({
        title: "Sales pipeline slowing",
        message: `${Math.round(staleRatio * 100)}% of your open leads haven't moved forward in over a week.`,
      });
    }
  }

  if (inStock.length >= 3 && agingVehicles.length / inStock.length >= 0.3) {
    risks.push({
      title: "Inventory aging across the fleet",
      message: `${agingVehicles.length} of ${inStock.length} vehicles have been in stock 60+ days.`,
    });
  }

  // ---- Business Health Engine ----
  const leadAlertCount = alerts.filter(a => a.category === "lead").length;
  const leadHealth = openLeads.length === 0
    ? 100
    : Math.max(0, Math.round(100 - (leadAlertCount / openLeads.length) * 100));

  const inventoryHealth = inStock.length === 0
    ? 100
    : Math.max(0, Math.round(100 - (agingVehicles.length / inStock.length) * 100));

  // Real sales momentum — this 30-day window vs the 30 days before it,
  // not an all-time ratio (which would only ever fall as old records
  // pile into the denominator — a real number computed in a misleading
  // way, same trap flagged elsewhere in project memory).
  const salesLast30Days = sales.filter(s => (daysSince(s.date, now) ?? 999) <= 30).length;
  const salesPrev30Days = sales.filter(s => {
    const age = daysSince(s.date, now);
    return age != null && age > 30 && age <= 60;
  }).length;
  const salesHealth = salesPrev30Days === 0
    ? (salesLast30Days > 0 ? 80 : 50) // no prior baseline to compare against — neutral-to-positive if anything sold, neutral otherwise
    : Math.max(0, Math.min(100, Math.round(50 + ((salesLast30Days - salesPrev30Days) / salesPrev30Days) * 100)));

  const activityHealth = recentActivityCount === 0 ? 40 : Math.min(100, 60 + recentActivityCount * 5);

  const overall = Math.round((leadHealth + inventoryHealth + salesHealth + activityHealth) / 4);

  return {
    health: { overall, salesHealth, leadHealth, inventoryHealth, activityHealth },
    alerts,
    risks,
    activity,
  };
}
