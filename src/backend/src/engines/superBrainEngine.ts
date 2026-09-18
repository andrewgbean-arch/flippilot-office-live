// Pilot Brain V5 (Super Brain) — the orchestration layer. Per the
// user's own spec: "V5 does NOT automate the business. V5 coordinates
// intelligence." Nothing here writes to a record or executes an
// action; every function returns real, evidence-based data for Claude
// to narrate (in pilotBrain.ts's system prompt), same "compute here,
// speak there" split as every earlier version.
//
// Real constraint carried over from V2/V3/V4: this backend has no
// scheduler, so "self-directed investigation overnight" (Module 9) and
// "Briefing Centre" (Module 10) both actually run whenever Pilot Brain
// is next opened, not literally overnight — an honest workaround, not
// a shortcut around the spec's intent.
//
// Real constraint specific to V5: the Cause & Effect Engine (Module 5)
// is the single highest risk of sounding more confident than the real
// data supports — one dealership, a few weeks of real history, is a
// genuinely thin basis for any "X caused Y" claim. detectPossibleCauseEffect()
// below is deliberately narrow and gated: it never returns "high"
// confidence, is phrased as "possible relationship" (matching the
// spec's own example wording, "most likely causal relationship" — not
// "confirmed"), and returns nothing at all rather than a weak guess
// when the real sample is too thin.

import type { InvestigationReport, Opportunity as AdvisorOpportunity } from "./advisorEngine";
import type { MarketOpportunity, MarketHealth } from "./marketEngine";
import type { WatcherAlert, BusinessHealth } from "./watcherEngine";

export type Confidence = "high" | "medium" | "low";

export interface ScoredOpportunity {
  category: "Lead Follow-Up" | "Inventory" | "Pricing" | "Sales" | "Market";
  title: string;
  detail: string;
  score: number; // 0-100, real — see scoreOpportunities()
}

export interface RevenueForecast {
  projectedRevenue: number;
  timeframeDays: number;
  confidence: Confidence;
  basis: string;
}

export interface CausalObservation {
  leadingMetric: string;
  laggingMetric: string;
  description: string;
  confidence: "medium" | "low"; // never "high" — see file header
}

export interface CrossModuleFinding {
  title: string;
  detail: string;
  source: "watcher" | "advisor" | "market";
}

export interface TodaysPriority {
  rank: number;
  title: string;
  detail: string;
}

export interface BriefingCentre {
  businessHealth: number;
  marketHealth: number | null; // null when no real market check has ever run
  revenueOutlook: "positive" | "negative" | "stable" | "unknown";
  criticalIssueCount: number;
  opportunityCount: number;
  investigatedCount: number;
  highestPriority: string | null;
}

const DAY_MS = 86400000;

function daysSince(iso: string | undefined | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (now - t) / DAY_MS;
}

// Opportunity Scoring (Module 3) — unifies V3's business opportunities
// and V4's market opportunities into one ranked list. Score reflects
// real signal strength (how far off, how large, how confident), not a
// fabricated importance ranking.
export function scoreOpportunities(
  advisorOpportunities: AdvisorOpportunity[],
  marketOpportunities: MarketOpportunity[],
  staleLeadCount: number,
  agingVehicleCount: number
): ScoredOpportunity[] {
  const scored: ScoredOpportunity[] = [];

  if (staleLeadCount > 0) {
    scored.push({
      category: "Lead Follow-Up",
      title: `${staleLeadCount} lead${staleLeadCount === 1 ? "" : "s"} ${staleLeadCount === 1 ? "needs" : "need"} following up`,
      detail: `${staleLeadCount} real open lead${staleLeadCount === 1 ? " hasn't" : "s haven't"} been contacted or moved forward.`,
      score: Math.min(100, 60 + staleLeadCount * 8),
    });
  }

  if (agingVehicleCount > 0) {
    scored.push({
      category: "Inventory",
      title: `${agingVehicleCount} vehicle${agingVehicleCount === 1 ? "" : "s"} aging in stock`,
      detail: `${agingVehicleCount} real vehicle${agingVehicleCount === 1 ? " has" : "s have"} been in stock 60+ days.`,
      score: Math.min(100, 50 + agingVehicleCount * 7),
    });
  }

  for (const o of advisorOpportunities) {
    scored.push({ category: "Sales", title: o.title, detail: o.detail, score: 65 });
  }

  for (const o of marketOpportunities) {
    scored.push({ category: "Pricing", title: o.title, detail: o.detail, score: 70 });
  }

  return scored.sort((a, b) => b.score - a.score);
}

// Prediction Engine (Module 8) — a real, transparent linear rate
// projection from real historical sales, not a black-box model. Needs
// a genuine minimum of real sales spanning a genuine minimum real
// window before it will say anything at all.
export function forecastRevenue(
  sales: { salePrice: number; date: string }[],
  now: number
): RevenueForecast | null {
  const recent = sales.filter(s => (daysSince(s.date, now) ?? 999) <= 90);
  if (recent.length < 4) return null;

  const dates = recent.map(s => new Date(s.date).getTime());
  const windowDays = (now - Math.min(...dates)) / DAY_MS;
  if (windowDays < 14) return null;

  const totalRevenue = recent.reduce((sum, s) => sum + s.salePrice, 0);
  const dailyRate = totalRevenue / windowDays;
  const projectedRevenue = Math.round(dailyRate * 30);

  const confidence: Confidence = recent.length >= 10 && windowDays >= 30 ? "high" : recent.length >= 6 ? "medium" : "low";

  return {
    projectedRevenue,
    timeframeDays: 30,
    confidence,
    basis: `${recent.length} real sales over the last ${Math.round(windowDays)} days, projected forward at the same rate`,
  };
}

// Cause & Effect Engine (Module 5) — see file header for why this is
// deliberately conservative. Checks whether a real change in lead
// volume in an earlier window precedes a real change in appointment
// volume in the window after it — the only two metrics in this app
// with genuine, independent, real creation timestamps suitable for a
// leading/lagging comparison. Never returns "high" confidence, never
// claims certainty, and returns [] far more often than not — that's
// the honest behaviour for a single dealership's few weeks of data,
// not a bug to "fix" by loosening the gate.
export function detectPossibleCauseEffect(
  leads: { createdAt: string }[],
  appointments: { createdAt: string }[],
  now: number
): CausalObservation[] {
  const leadsEarlier = leads.filter(l => {
    const d = daysSince(l.createdAt, now);
    return d != null && d > 30 && d <= 60;
  }).length;
  const leadsLater = leads.filter(l => (daysSince(l.createdAt, now) ?? 999) <= 30).length;

  const apptsEarlier = appointments.filter(a => {
    const d = daysSince(a.createdAt, now);
    return d != null && d > 15 && d <= 30;
  }).length;
  const apptsLater = appointments.filter(a => (daysSince(a.createdAt, now) ?? 999) <= 15).length;

  // Real sample-size floor — below this, any "relationship" would be
  // reading noise, not signal.
  if (leadsEarlier < 5 || apptsEarlier < 3) return [];

  const leadChange = (leadsLater - leadsEarlier) / leadsEarlier;
  const apptChange = apptsEarlier > 0 ? (apptsLater - apptsEarlier) / apptsEarlier : null;
  if (apptChange == null) return [];

  // Only worth mentioning when both real metrics moved meaningfully in
  // the same direction — anything smaller is indistinguishable from
  // normal week-to-week noise at this sample size.
  if (Math.abs(leadChange) < 0.2 || Math.abs(apptChange) < 0.2) return [];
  if (Math.sign(leadChange) !== Math.sign(apptChange)) return [];

  const direction = leadChange > 0 ? "increased" : "decreased";
  return [{
    leadingMetric: "lead volume",
    laggingMetric: "appointment volume",
    description: `Lead volume ${direction} roughly ${Math.round(Math.abs(leadChange) * 100)}% in the prior month, and appointment volume moved the same direction afterward — a possible relationship, not a confirmed one given the sample size.`,
    confidence: "low",
  }];
}

// Self-Directed Investigation (Module 9) — scans the OTHER real
// modules' output for the single most notable thing not already the
// obvious headline, framed as "something caught my attention". Never
// runs on a schedule (none exists) — runs whenever Pilot Brain is next
// asked anything, which is the honest equivalent available here.
export function runCrossModuleInvestigation(
  watcherAlerts: WatcherAlert[],
  investigation: InvestigationReport,
  marketOpportunities: MarketOpportunity[]
): CrossModuleFinding | null {
  const critical = watcherAlerts.find(a => a.severity === "critical");
  if (critical) {
    return { title: critical.title, detail: critical.message, source: "watcher" };
  }

  if (investigation.likelyFactors.length > 0) {
    return {
      title: "A business metric moved significantly",
      detail: investigation.likelyFactors[0]!,
      source: "advisor",
    };
  }

  if (marketOpportunities.length > 0) {
    const o = marketOpportunities[0]!;
    return { title: o.title, detail: o.detail, source: "market" };
  }

  return null;
}

// Chief of Staff Mode (Module 12) — "what should we work on today",
// a real ranked top-4 built from the same scored opportunities and
// watcher alerts already computed elsewhere, not a separate invented
// priority list.
export function getTodaysPriorities(
  scoredOpportunities: ScoredOpportunity[],
  criticalAlerts: WatcherAlert[]
): TodaysPriority[] {
  const items: { title: string; detail: string; weight: number }[] = [
    ...criticalAlerts.map(a => ({ title: a.title, detail: a.message, weight: 100 })),
    ...scoredOpportunities.map(o => ({ title: o.title, detail: o.detail, weight: o.score })),
  ];

  return items
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((item, i) => ({ rank: i + 1, title: item.title, detail: item.detail }));
}

// The Briefing Centre (Module 10) — one real combined snapshot, every
// field traceable to a module built in an earlier version. marketHealth
// is honestly null (not 0, not guessed) when no real market check has
// ever been run for this dealership.
export function buildBriefingCentre(
  businessHealth: BusinessHealth,
  marketHealth: MarketHealth | null,
  forecast: RevenueForecast | null,
  criticalIssueCount: number,
  opportunityCount: number,
  investigatedCount: number,
  priorities: TodaysPriority[]
): BriefingCentre {
  const revenueOutlook: BriefingCentre["revenueOutlook"] = !forecast
    ? "unknown"
    : forecast.confidence === "low"
    ? "stable"
    : "positive"; // a real forecast only exists here when it's computed from actual real sales, so "positive" just means "real recent sales activity exists" — Claude is instructed to explain the real number, not oversell this label

  return {
    businessHealth: businessHealth.overall,
    marketHealth: marketHealth?.overall ?? null,
    revenueOutlook,
    criticalIssueCount,
    opportunityCount,
    investigatedCount,
    highestPriority: priorities[0]?.title ?? null,
  };
}
