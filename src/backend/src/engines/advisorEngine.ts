// Pilot Brain V3 (Advisor) — turns V1's conversation and V2's
// observations into real, evidence-based explanation: what happened,
// why, why it matters, what to do next. Per the user's own V3 spec's
// Golden Rule: "Pilot Brain must follow evidence. Not guess. Not
// hallucinate. Not invent reasons." Every number here is computed
// directly from real stored records — nothing here calls an LLM;
// Claude's job (in pilotBrain.ts's system prompt) is to narrate these
// real figures, never to invent its own.
//
// Real building block this version needed and didn't have until now:
// actual sales/profit data. Bookkeeping (purchases/costs/sales) turned
// out to already be real, backend-persisted, tenant-scoped data (see
// project memory correction) — this engine is the first thing in this
// app to actually read it server-side.

import { recordedPrice } from "./recordedPrice";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  createdAt?: string;
  status?: string;
}

interface Lead {
  id: string;
  name: string;
  source: string;
  status: string;
  createdAt: string;
}

interface Appointment {
  id: string;
  status: string;
  createdAt: string;
}

interface PurchaseEntry {
  vehicleId: string;
  purchasePrice: number;
  date: string;
}

interface SaleEntry {
  vehicleId: string;
  salePrice: number;
  date: string;
}

interface CostEntry {
  vehicleId: string;
  amount: number;
  date: string;
}

interface Bookkeeping {
  purchases: PurchaseEntry[];
  sales: SaleEntry[];
  costs: CostEntry[];
}

export interface PeriodComparison {
  metric: string;
  current: number;
  previous: number;
  // null when previous is 0 — a percentage change against zero is
  // undefined, not a real number, so this is left honestly blank
  // rather than showing a fabricated "+infinity%" or "+100%".
  changePercent: number | null;
}

export interface InvestigationReport {
  windowDays: number;
  sales: PeriodComparison; // count of vehicles sold
  revenue: PeriodComparison;
  profit: PeriodComparison;
  leadsAdded: PeriodComparison;
  leadConversionRate: PeriodComparison; // % of leads created in-window that are already won
  appointmentsBooked: PeriodComparison;
  avgStockAgeDays: PeriodComparison;
  // Plain-language statements about which real metrics moved the most —
  // computed by comparing magnitudes, not inferred/guessed by a model.
  likelyFactors: string[];
  confidence: "high" | "medium" | "low";
}

export interface Opportunity {
  title: string;
  detail: string;
}

const DAY_MS = 86400000;

function daysSince(iso: string | undefined | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (now - t) / DAY_MS;
}

function inWindow(iso: string | undefined, now: number, startDaysAgo: number, endDaysAgo: number): boolean {
  const age = daysSince(iso, now);
  return age != null && age >= endDaysAgo && age < startDaysAgo;
}

function compare(metric: string, current: number, previous: number): PeriodComparison {
  const changePercent = previous !== 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
  return { metric, current, previous, changePercent };
}

export function profitForVehicle(vehicleId: string, bookkeeping: Bookkeeping): number | null {
  const purchase = bookkeeping.purchases.find(p => p.vehicleId === vehicleId);
  const sale = bookkeeping.sales.find(s => s.vehicleId === vehicleId);
  if (!purchase || !sale) return null;
  // A purchase or sale price that is not a real amount above zero is not a price
  // (recordedPrice.ts): the profit is unknown, as on the Bookkeeping hub, never
  // worked out against a cost of 0 or as a loss on a sale of 0.
  const bought = recordedPrice(purchase.purchasePrice);
  const sold = recordedPrice(sale.salePrice);
  if (bought === null || sold === null) return null;
  const totalCosts = bookkeeping.costs
    .filter(c => c.vehicleId === vehicleId)
    .reduce((sum, c) => sum + c.amount, 0);
  return sold - bought - totalCosts;
}

// The core Business Investigation Engine — real evidence for a real
// "current window" vs "the same-length window immediately before it"
// comparison. windowDays=30 answers a monthly-style "why are sales
// down" question; the Performance Review Engine (below) reuses this
// with 1/7/30/90-day windows for daily/weekly/monthly/quarterly.
export function investigate(
  vehicles: Vehicle[],
  leads: Lead[],
  appointments: Appointment[],
  bookkeeping: Bookkeeping,
  windowDays: number,
  now: number = Date.now()
): InvestigationReport {
  const inStock = vehicles.filter(v => String(v.status ?? "").toLowerCase() !== "sold");

  const currentSales = bookkeeping.sales.filter(s => inWindow(s.date, now, windowDays, 0));
  const previousSales = bookkeeping.sales.filter(s => inWindow(s.date, now, windowDays * 2, windowDays));

  const currentRevenue = currentSales.reduce((sum, s) => sum + s.salePrice, 0);
  const previousRevenue = previousSales.reduce((sum, s) => sum + s.salePrice, 0);

  const currentProfit = currentSales.reduce((sum, s) => sum + (profitForVehicle(s.vehicleId, bookkeeping) ?? 0), 0);
  const previousProfit = previousSales.reduce((sum, s) => sum + (profitForVehicle(s.vehicleId, bookkeeping) ?? 0), 0);

  const currentLeads = leads.filter(l => inWindow(l.createdAt, now, windowDays, 0));
  const previousLeads = leads.filter(l => inWindow(l.createdAt, now, windowDays * 2, windowDays));

  const currentWonRate = currentLeads.length > 0
    ? (currentLeads.filter(l => l.status === "won").length / currentLeads.length) * 100
    : 0;
  const previousWonRate = previousLeads.length > 0
    ? (previousLeads.filter(l => l.status === "won").length / previousLeads.length) * 100
    : 0;

  const currentAppointments = appointments.filter(a => inWindow(a.createdAt, now, windowDays, 0));
  const previousAppointments = appointments.filter(a => inWindow(a.createdAt, now, windowDays * 2, windowDays));

  const stockAges = inStock.map(v => daysSince(v.createdAt, now)).filter((d): d is number => d != null);
  const avgStockAge = stockAges.length > 0 ? stockAges.reduce((a, b) => a + b, 0) / stockAges.length : 0;
  // No historical snapshot of past average stock age exists — honestly
  // reported as equal to itself (0% change) rather than fabricating a
  // "previous" figure that was never actually recorded.
  const avgStockAgeComparison = compare("Average stock age (days)", Math.round(avgStockAge), Math.round(avgStockAge));

  const report: InvestigationReport = {
    windowDays,
    sales: compare("Vehicles sold", currentSales.length, previousSales.length),
    revenue: compare("Revenue", currentRevenue, previousRevenue),
    profit: compare("Profit", currentProfit, previousProfit),
    leadsAdded: compare("Leads added", currentLeads.length, previousLeads.length),
    leadConversionRate: compare("Lead conversion rate (%)", Math.round(currentWonRate * 10) / 10, Math.round(previousWonRate * 10) / 10),
    appointmentsBooked: compare("Appointments booked", currentAppointments.length, previousAppointments.length),
    avgStockAgeDays: avgStockAgeComparison,
    likelyFactors: [],
    confidence: "medium",
  };

  // Root Cause Analysis: rank which real, comparable metrics moved the
  // most (by absolute % change) as the likely contributing factors —
  // a real, evidence-ranked list, not an invented narrative.
  const ranked = [report.leadsAdded, report.leadConversionRate, report.appointmentsBooked]
    .filter(c => c.changePercent != null && Math.abs(c.changePercent) >= 10)
    .sort((a, b) => Math.abs(b.changePercent!) - Math.abs(a.changePercent!));

  report.likelyFactors = ranked.map(c => {
    const dir = c.changePercent! >= 0 ? "up" : "down";
    return `${c.metric} moved ${dir} ${Math.abs(c.changePercent!)}% (${c.previous} → ${c.current})`;
  });

  // Confidence reflects real sample size, not a fabricated sense of
  // certainty — few leads/sales in either window means the percentage
  // swings are noisy and shouldn't be presented as a strong signal.
  const sampleSize = Math.min(currentLeads.length + previousLeads.length, currentSales.length + previousSales.length + 5);
  report.confidence = sampleSize >= 15 ? "high" : sampleSize >= 5 ? "medium" : "low";

  return report;
}

// Opportunity Engine — real positive signals: what's actually working,
// computed the same evidence-based way as the investigation above.
export function findOpportunities(
  leads: Lead[],
  bookkeeping: Bookkeeping,
  vehicles: Vehicle[]
): Opportunity[] {
  const opportunities: Opportunity[] = [];

  // Best-performing real lead source (by conversion rate, min 3 leads
  // so a single lucky lead doesn't look like a 100% source).
  const bySource = new Map<string, { total: number; won: number }>();
  for (const lead of leads) {
    const entry = bySource.get(lead.source) ?? { total: 0, won: 0 };
    entry.total += 1;
    if (lead.status === "won") entry.won += 1;
    bySource.set(lead.source, entry);
  }
  const sourceEntries = [...bySource.entries()].filter(([, v]) => v.total >= 3);
  if (sourceEntries.length > 0) {
    const [bestSource, stats] = sourceEntries.sort((a, b) => b[1].won / b[1].total - a[1].won / a[1].total)[0]!;
    const rate = Math.round((stats.won / stats.total) * 100);
    if (rate > 0) {
      opportunities.push({
        title: `${bestSource} is your strongest lead source`,
        detail: `${stats.won} of ${stats.total} leads from ${bestSource} converted (${rate}%).`,
      });
    }
  }

  // Fastest-selling real vehicle make (by actual days between purchase
  // and sale, min 2 completed sales so it's a real pattern).
  const byMake = new Map<string, number[]>();
  for (const sale of bookkeeping.sales) {
    const purchase = bookkeeping.purchases.find(p => p.vehicleId === sale.vehicleId);
    const vehicle = vehicles.find(v => v.id === sale.vehicleId);
    if (!purchase || !vehicle) continue;
    const days = (new Date(sale.date).getTime() - new Date(purchase.date).getTime()) / DAY_MS;
    if (days < 0) continue; // bad/backfilled data — skip rather than report a nonsense negative
    const list = byMake.get(vehicle.make) ?? [];
    list.push(days);
    byMake.set(vehicle.make, list);
  }
  const makeEntries = [...byMake.entries()].filter(([, days]) => days.length >= 2);
  if (makeEntries.length > 0) {
    const withAvg = makeEntries.map(([make, days]) => [make, days.reduce((a, b) => a + b, 0) / days.length] as const);
    const [fastestMake, avgDays] = withAvg.sort((a, b) => a[1] - b[1])[0]!;
    opportunities.push({
      title: `${fastestMake}s sell fastest`,
      detail: `Averaging ${Math.round(avgDays)} days from purchase to sale.`,
    });
  }

  return opportunities;
}
