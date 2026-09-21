import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { readCollection, readTenantCollection, writeTenantCollection, readTenantDoc } from "../db";
import { requireAuth, requireStaffRole, type AuthUser, type Dealership } from "../auth";
import {
  computeGoalProgress,
  computeStrategicHealth,
  runScenario,
  buildBusinessSimulation,
  type BusinessGoal,
  type GoalMetric,
  type GoalProgress,
} from "../engines/cofounderEngine";
import { runWatcher } from "../engines/watcherEngine";
import { investigate, findOpportunities } from "../engines/advisorEngine";
import { getStoredMarketData } from "./marketIntelligence";
import { recordedPrice } from "../engines/recordedPrice";
import { scoreOpportunities, runCrossModuleInvestigation, getTodaysPriorities } from "../engines/superBrainEngine";

const GOALS_COLLECTION = "pilotBrainGoals";

interface BookkeepingDoc {
  purchases: { vehicleId: string; purchasePrice: number; date: string }[];
  sales: { vehicleId: string; salePrice: number; date: string }[];
  costs: { vehicleId: string; amount: number; date: string }[];
}
const EMPTY_BOOKKEEPING: BookkeepingDoc = { purchases: [], sales: [], costs: [] };

function authUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

function daysSince(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / 86400000;
}

const PERIOD_DAYS: Record<BusinessGoal["period"], number> = { monthly: 30, quarterly: 90 };

// Real current value for a real goal's metric — every branch reads
// directly from real stored data, the same collections every earlier
// version already reads from.
function computeCurrentMetricValue(
  metric: GoalMetric,
  period: BusinessGoal["period"],
  vehicles: any[],
  leads: any[],
  bookkeeping: BookkeepingDoc,
  now: number
): number {
  const windowDays = PERIOD_DAYS[period];

  if (metric === "stockCount") {
    return vehicles.filter(v => String(v.status ?? "").toLowerCase() !== "sold").length;
  }
  if (metric === "leadsAdded") {
    return leads.filter(l => daysSince(l.createdAt, now) <= windowDays).length;
  }
  const recentSales = bookkeeping.sales.filter(s => daysSince(s.date, now) <= windowDays);
  if (metric === "salesCount") {
    return recentSales.length;
  }
  if (metric === "revenue") {
    return recentSales.reduce((sum, s) => sum + s.salePrice, 0);
  }
  // profit
  return recentSales.reduce((sum, s) => {
    const purchase = bookkeeping.purchases.find(p => p.vehicleId === s.vehicleId);
    const costs = bookkeeping.costs.filter(c => c.vehicleId === s.vehicleId).reduce((a, c) => a + c.amount, 0);
    if (!purchase) return sum;
    // Only a car whose purchase AND sale prices are real amounts above zero has a
    // profit that can be worked out (engines/recordedPrice.ts): otherwise it is
    // left out, as on the Bookkeeping hub, never counted against a cost of 0.
    const bought = recordedPrice(purchase.purchasePrice);
    const sold = recordedPrice(s.salePrice);
    if (bought === null || sold === null) return sum;
    return sum + (sold - bought - costs);
  }, 0);
}

function readBookkeeping(dealershipId: string): BookkeepingDoc {
  return readTenantDoc<BookkeepingDoc>(dealershipId, "bookkeeping", EMPTY_BOOKKEEPING);
}

export function computeAllGoalProgress(dealershipId: string, now: number): GoalProgress[] {
  const goals = readTenantCollection<BusinessGoal>(dealershipId, GOALS_COLLECTION);
  const vehicles = readTenantCollection<any>(dealershipId, "vehicles");
  const leads = readTenantCollection<any>(dealershipId, "leads");
  const bookkeeping = readBookkeeping(dealershipId);

  return goals.map(goal => {
    const currentValue = computeCurrentMetricValue(goal.metric, goal.period, vehicles, leads, bookkeeping, now);
    return computeGoalProgress(goal, currentValue, now);
  });
}

export default function registerCofounderRoute(app: Express) {
  app.get("/pilot-brain/goals", requireAuth, (req, res) => {
    const user = authUser(req);
    const progress = computeAllGoalProgress(user.dealershipId, Date.now());
    res.json({ ok: true, goals: progress });
  });

  // Setting a real business goal is a strategic decision — owner/manager
  // only, same trust tier as approving V6's prepared actions.
  app.post("/pilot-brain/goals", requireAuth, requireStaffRole("manager"), (req, res) => {
    const user = authUser(req);
    const { metric, targetValue, period, label } = req.body ?? {};
    const validMetrics: GoalMetric[] = ["revenue", "profit", "stockCount", "leadsAdded", "salesCount"];
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({ ok: false, error: "Invalid metric" });
    }
    if (typeof targetValue !== "number" || targetValue <= 0) {
      return res.status(400).json({ ok: false, error: "targetValue must be a positive number" });
    }
    if (period !== "monthly" && period !== "quarterly") {
      return res.status(400).json({ ok: false, error: "period must be monthly or quarterly" });
    }

    const goals = readTenantCollection<BusinessGoal>(user.dealershipId, GOALS_COLLECTION);
    const goal: BusinessGoal = {
      id: randomUUID(),
      metric,
      targetValue,
      period,
      label: typeof label === "string" && label.trim() ? label.trim() : `${metric} target: ${targetValue}`,
      createdAt: new Date().toISOString(),
      createdByName: user.name,
    };
    writeTenantCollection(user.dealershipId, GOALS_COLLECTION, [...goals, goal]);
    res.json({ ok: true, goal });
  });

  app.delete("/pilot-brain/goals/:id", requireAuth, requireStaffRole("manager"), (req, res) => {
    const user = authUser(req);
    const goals = readTenantCollection<BusinessGoal>(user.dealershipId, GOALS_COLLECTION);
    writeTenantCollection(user.dealershipId, GOALS_COLLECTION, goals.filter(g => g.id !== req.params.id));
    res.json({ ok: true });
  });

  // Scenario Engine (Module 3) — real transparent "what if" math off a
  // real current value, never historical pattern-mining.
  app.post("/pilot-brain/scenario", requireAuth, (req, res) => {
    const user = authUser(req);
    const { metric, changePercent } = req.body ?? {};
    const validMetrics: GoalMetric[] = ["revenue", "profit", "stockCount", "leadsAdded", "salesCount"];
    if (!validMetrics.includes(metric) || typeof changePercent !== "number") {
      return res.status(400).json({ ok: false, error: "metric and changePercent (number) are required" });
    }

    const now = Date.now();
    const vehicles = readTenantCollection<any>(user.dealershipId, "vehicles");
    const leads = readTenantCollection<any>(user.dealershipId, "leads");
    const bookkeeping = readBookkeeping(user.dealershipId);
    const currentValue = computeCurrentMetricValue(metric, "monthly", vehicles, leads, bookkeeping, now);

    const scenario = runScenario(metric, currentValue, changePercent);
    const simulation = buildBusinessSimulation(metric, currentValue);
    res.json({ ok: true, scenario, simulation });
  });

  // Executive Briefings (Module 9) — one real leadership-level snapshot:
  // Strategic Health (real Business+Market+Goal health), greatest real
  // opportunity, greatest real risk, recommended focus — every field
  // traceable to an engine built in an earlier version, nothing new
  // invented for this one summary.
  app.get("/pilot-brain/executive-briefing", requireAuth, (req, res) => {
    const user = authUser(req);
    const now = Date.now();

    const vehicles = readTenantCollection<any>(user.dealershipId, "vehicles");
    const leads = readTenantCollection<any>(user.dealershipId, "leads");
    const appointments = readTenantCollection<any>(user.dealershipId, "appointments");
    const jobs = readTenantCollection<any>(user.dealershipId, "jobs");
    const bookkeeping = readBookkeeping(user.dealershipId);

    const watcher = runWatcher(vehicles, leads, appointments, jobs, bookkeeping.sales);
    const investigation = investigate(vehicles, leads, appointments, bookkeeping, 30, now);
    const advisorOpportunities = findOpportunities(leads, bookkeeping, vehicles);
    const marketData = getStoredMarketData(user.dealershipId);
    const scored = scoreOpportunities(
      advisorOpportunities,
      marketData.opportunities,
      watcher.alerts.filter(a => a.category === "lead").length,
      watcher.alerts.filter(a => a.category === "inventory").length
    );
    const criticalAlerts = watcher.alerts.filter(a => a.severity === "critical");
    const priorities = getTodaysPriorities(scored, criticalAlerts);
    const crossModuleFinding = runCrossModuleInvestigation(watcher.alerts, investigation, marketData.opportunities);

    const goalProgress = computeAllGoalProgress(user.dealershipId, now);
    const goalProgressAverage = goalProgress.length > 0
      ? Math.round(goalProgress.reduce((sum, g) => sum + g.percent, 0) / goalProgress.length)
      : null;

    const strategicHealth = computeStrategicHealth(watcher.health.overall, marketData.health?.overall ?? null, goalProgressAverage);

    const greatestOpportunity = scored[0] ?? null;
    const greatestRisk = criticalAlerts[0] ?? (crossModuleFinding && crossModuleFinding.source !== "advisor" ? crossModuleFinding : null);

    res.json({
      ok: true,
      businessHealth: watcher.health.overall,
      marketHealth: marketData.health?.overall ?? null,
      strategicHealth,
      greatestOpportunity,
      greatestRisk,
      recommendedFocus: priorities[0] ?? null,
      goalProgress,
    });
  });
}
