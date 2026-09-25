import { randomUUID } from "crypto";
import { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { readCollection, writeCollection, readTenantCollection } from "../db";
import { requireAuth, type AuthUser } from "../auth";
import { fetchEbayCarComps } from "../ebayCarMarket";
import {
  shouldRecordSnapshot,
  getTrend,
  computePricingIntelligence,
  computeMarketHealth,
  findMarketOpportunities,
  getPlatformInsight,
  type MarketSnapshot,
  type PricingIntelligence,
  type MarketHealth,
  type MarketOpportunity,
  type TrendResult,
  type PlatformInsight,
} from "../engines/marketEngine";
import { formatPounds } from "../money";

export interface StoredMarketData {
  health: MarketHealth | null; // null when no real market data has ever been recorded
  opportunities: MarketOpportunity[];
}

// V5's fast path — same "read only what's already recorded, no live
// eBay calls" reasoning as buildMarketSummaryFromStorage, but returns
// structured data instead of prose, for superBrainEngine's Opportunity
// Scoring and Briefing Centre (which need real numbers, not text).
export function getStoredMarketData(dealershipId: string): StoredMarketData {
  const vehicles = readTenantCollection<any>(dealershipId, "vehicles");
  const inStock = vehicles.filter(v => String(v.status ?? "").toLowerCase() !== "sold" && v.make && v.model);
  const snapshots = readCollection<MarketSnapshot>(SNAPSHOTS_COLLECTION);

  const pricingIntel: PricingIntelligence[] = [];
  const compsUsed: { demandScore: number; sampleSize: number }[] = [];

  for (const v of inStock) {
    const matching = snapshots.filter(s => s.make === v.make && s.model === v.model);
    if (matching.length === 0) continue;
    const latest = [...matching].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0]!;
    compsUsed.push({ demandScore: latest.demandScore, sampleSize: latest.sampleSize });
    if (v.priceRetail) {
      pricingIntel.push(computePricingIntelligence(v.id, v.make, v.model, v.priceRetail, {
        average: latest.avgPrice,
        sampleSize: latest.sampleSize,
      }));
    }
  }

  if (compsUsed.length === 0) {
    return { health: null, opportunities: [] };
  }

  return {
    health: computeMarketHealth(pricingIntel, compsUsed),
    opportunities: findMarketOpportunities(pricingIntel),
  };
}

const SNAPSHOTS_COLLECTION = "marketSnapshots";

// Platform Intelligence framework (see marketEngine.ts's
// getPlatformInsight) — internal bookkeeping only, a real dealershipId
// per row, but NEVER surfaced by identity anywhere: nothing in this
// file returns this collection's rows or any single dealership's
// membership in it. Only a COUNT ever leaves this function, which is
// what makes the "never expose dealer identity" rule hold while still
// letting the gate know how many real, distinct dealerships exist.
const PLATFORM_ACTIVITY_COLLECTION = "platformDealerActivity";

interface DealerActivityRecord {
  dealershipId: string;
  lastActiveAt: string;
}

function recordDealerActivity(dealershipId: string) {
  const existing = readCollection<DealerActivityRecord>(PLATFORM_ACTIVITY_COLLECTION);
  const alreadyKnown = existing.some(r => r.dealershipId === dealershipId);
  if (alreadyKnown) {
    writeCollection(
      PLATFORM_ACTIVITY_COLLECTION,
      existing.map(r => (r.dealershipId === dealershipId ? { ...r, lastActiveAt: new Date().toISOString() } : r))
    );
  } else {
    writeCollection(PLATFORM_ACTIVITY_COLLECTION, [
      ...existing,
      { dealershipId, lastActiveAt: new Date().toISOString() },
    ]);
  }
}

function getDistinctActiveDealershipCount(): number {
  return readCollection<DealerActivityRecord>(PLATFORM_ACTIVITY_COLLECTION).length;
}

// Real eBay quota is generous (5,000 calls/day for the whole app) but
// not unlimited — capped so one dealer's market check, on a large
// stock, can't reasonably exhaust the shared daily budget on its own.
const MAX_VEHICLES_PER_CHECK = 15;

function authUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// Real external API cost behind every call (same eBay budget the
// existing /market/ebay-comps route already shares) — its own limit
// since a market check can fan out to several real eBay calls at once.
const marketLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 500 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many market intelligence requests — please try again later." },
});

export interface MarketCheckResult {
  health: MarketHealth;
  pricingIntel: PricingIntelligence[];
  trends: Record<string, TrendResult>;
  opportunities: MarketOpportunity[];
  vehiclesChecked: number;
  platformInsight: PlatformInsight;
}

// The real, live-fetching path — explicitly triggered (dealer opens
// Market Intelligence, or asks Pilot Brain to check), never automatic
// on every chat message. Fetches real eBay comps for the dealer's own
// current stock, records a real snapshot per make/model (deduped to
// at most one per ~20h so history reflects real elapsed time, not
// repeated clicks), and computes Market Health/Pricing/Opportunities
// from what actually came back.
export async function runMarketCheck(dealershipId: string): Promise<MarketCheckResult> {
  recordDealerActivity(dealershipId);
  const vehicles = readTenantCollection<any>(dealershipId, "vehicles");
  const inStock = vehicles
    .filter(v => String(v.status ?? "").toLowerCase() !== "sold" && v.make && v.model)
    .slice(0, MAX_VEHICLES_PER_CHECK);

  const existingSnapshots = readCollection<MarketSnapshot>(SNAPSHOTS_COLLECTION);
  const newSnapshots: MarketSnapshot[] = [];
  const pricingIntel: PricingIntelligence[] = [];
  const compsUsed: { demandScore: number; sampleSize: number }[] = [];
  const trends: Record<string, TrendResult> = {};
  const now = Date.now();

  for (const v of inStock) {
    const comps = await fetchEbayCarComps(v.make, v.model, v.year ?? null, v.mileage ?? v.mot?.mileage ?? null);
    if (!comps) continue;

    compsUsed.push({ demandScore: comps.demandScore, sampleSize: comps.sampleSize });

    if (v.priceRetail) {
      pricingIntel.push(computePricingIntelligence(v.id, v.make, v.model, v.priceRetail, comps));
    }

    const allSnapshotsSoFar = [...existingSnapshots, ...newSnapshots];
    if (shouldRecordSnapshot(allSnapshotsSoFar, v.make, v.model, now)) {
      newSnapshots.push({
        id: randomUUID(),
        make: v.make,
        model: v.model,
        avgPrice: comps.average,
        lowPrice: comps.lowest,
        highPrice: comps.highest,
        sampleSize: comps.sampleSize,
        demandScore: comps.demandScore,
        capturedAt: new Date(now).toISOString(),
      });
    }

    trends[`${v.make}|${v.model}`] = getTrend([...existingSnapshots, ...newSnapshots], v.make, v.model, now);
  }

  if (newSnapshots.length > 0) {
    writeCollection(SNAPSHOTS_COLLECTION, [...existingSnapshots, ...newSnapshots]);
  }

  return {
    health: computeMarketHealth(pricingIntel, compsUsed),
    pricingIntel,
    trends,
    opportunities: findMarketOpportunities(pricingIntel),
    vehiclesChecked: inStock.length,
    platformInsight: getPlatformInsight(getDistinctActiveDealershipCount()),
  };
}

// The fast path for chat/briefing context — reads only what's already
// been recorded, no live eBay calls, so an ordinary chat message never
// waits on external API latency. Honestly says nothing for a make/
// model this dealership has never had checked, rather than guessing —
// grows more complete the more the dealer actually uses the live
// Market Intelligence check.
export function buildMarketSummaryFromStorage(dealershipId: string): string {
  const vehicles = readTenantCollection<any>(dealershipId, "vehicles");
  const inStock = vehicles.filter(v => String(v.status ?? "").toLowerCase() !== "sold" && v.make && v.model);
  const snapshots = readCollection<MarketSnapshot>(SNAPSHOTS_COLLECTION);
  const now = Date.now();

  const lines: string[] = [];
  const seen = new Set<string>();

  for (const v of inStock) {
    const key = `${v.make}|${v.model}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const matching = snapshots.filter(s => s.make === v.make && s.model === v.model);
    if (matching.length === 0) continue;

    const latest = [...matching].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0]!;
    const trend = getTrend(snapshots, v.make, v.model, now);
    const deltaPercent = v.priceRetail ? Math.round(((v.priceRetail - latest.avgPrice) / latest.avgPrice) * 1000) / 10 : null;

    let line = `${v.make} ${v.model}: real market average ${formatPounds(Math.round(latest.avgPrice))} as of ${latest.capturedAt.slice(0, 10)} (${latest.sampleSize} comparable listings)`;
    if (deltaPercent != null) line += `, your price is ${deltaPercent >= 0 ? "+" : ""}${deltaPercent}% vs that`;
    if (trend.direction !== "insufficient_data") line += `, demand trend: ${trend.direction}`;
    lines.push(line);
  }

  if (lines.length === 0) {
    lines.push("No real market data has been checked yet for this dealership's stock — a live Market Intelligence check hasn't been run. Say so honestly if Boss asks about market pricing rather than guessing.");
  }

  lines.push(getPlatformInsight(getDistinctActiveDealershipCount()).message);

  return lines.join("\n");
}

export default function registerMarketIntelligenceRoute(app: Express) {
  // V4 (Market Intelligence) — real Market Health, per-vehicle Pricing
  // Intelligence, and Opportunities, computed fresh from this
  // dealership's own real stock against real eBay comparable listings.
  app.get("/pilot-brain/market", requireAuth, marketLimiter, async (req, res) => {
    const user = authUser(req);
    const result = await runMarketCheck(user.dealershipId);
    res.json({ ok: true, ...result });
  });
}
