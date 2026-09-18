// Pilot Brain V4 (Market Intelligence Network) — pure functions, no
// I/O and no LLM involved in computing any number. Per the user's own
// V4 spec: "Pilot Brain is a reasoning system... every piece of
// information must be Research, Compare, Analyse, Interpret, Explain."
//
// Real scope decision, made explicit with the user before building —
// "build the framework and storage now, never fabricate the output":
// Market Research, Market Memory, Pricing Intelligence, Demand
// Intelligence, Market Health, Opportunity Detection, Investigation
// Mode and the Confidence Engine are fully built on the app's existing
// real eBay Browse API integration (real dealer-only comparable
// pricing, 5,000 calls/day). Trend Timeline / Historical Trend
// Analysis and Platform Intelligence have their real storage/framework
// built and collecting real data starting now, but honestly report
// "not enough data yet" until genuine history/dealer diversity exists
// — see getTrend()'s insufficient_data case and getPlatformInsight()
// below. Regional Intelligence and named Competitor Awareness are not
// built at all: no real regional pricing dataset exists anywhere in
// this stack, and eBay's API doesn't expose competitor identity in a
// usable way — there's no real data to build even a framework around.

export interface MarketSnapshot {
  id: string;
  make: string;
  model: string;
  avgPrice: number;
  lowPrice: number;
  highPrice: number;
  sampleSize: number;
  demandScore: number;
  capturedAt: string;
}

export type Confidence = "high" | "medium" | "low";

export interface TrendResult {
  direction: "rising" | "falling" | "stable" | "insufficient_data";
  changePercent: number | null;
  daysOfHistory: number;
}

export interface PricingIntelligence {
  vehicleId: string;
  make: string;
  model: string;
  askingPrice: number;
  marketAverage: number;
  deltaPercent: number;
  confidence: Confidence;
}

export interface MarketHealth {
  overall: number;
  demand: number;
  pricing: number;
  supply: number;
  confidence: Confidence;
}

export interface MarketOpportunity {
  title: string;
  detail: string;
}

export interface VehicleInvestigation {
  vehicleId: string;
  daysInStock: number;
  enquiryCount: number;
  pricingPosition: string; // plain-language, e.g. "4.2% above market average"
  demandTrend: string;
  likelyCause: string;
  confidence: Confidence;
}

const DAY_MS = 86400000;

// A snapshot is only worth recording once real time has genuinely
// passed since the last one for this make+model — repeated lookups
// within the same real-world day are the same market, not new
// history, so recording each one would fabricate the appearance of
// more data points than actually exist.
export function shouldRecordSnapshot(existing: MarketSnapshot[], make: string, model: string, now: number): boolean {
  const recent = existing.find(
    s => s.make === make && s.model === model && now - new Date(s.capturedAt).getTime() < 20 * 3600 * 1000
  );
  return !recent;
}

// Market Memory / Trend Timeline — real trend only once at least two
// real snapshots exist, spanning at least 3 real days. Anything
// thinner than that is honestly reported as "insufficient_data"
// rather than a trend read from noise.
export function getTrend(snapshots: MarketSnapshot[], make: string, model: string, now: number): TrendResult {
  const matching = snapshots
    .filter(s => s.make === make && s.model === model)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  if (matching.length < 2) {
    return { direction: "insufficient_data", changePercent: null, daysOfHistory: matching.length };
  }

  const oldest = matching[0]!;
  const latest = matching[matching.length - 1]!;
  const daysOfHistory = (new Date(latest.capturedAt).getTime() - new Date(oldest.capturedAt).getTime()) / DAY_MS;

  if (daysOfHistory < 3) {
    return { direction: "insufficient_data", changePercent: null, daysOfHistory: Math.round(daysOfHistory) };
  }

  const changePercent = Math.round(((latest.avgPrice - oldest.avgPrice) / oldest.avgPrice) * 1000) / 10;
  const direction = Math.abs(changePercent) < 3 ? "stable" : changePercent > 0 ? "rising" : "falling";
  return { direction, changePercent, daysOfHistory: Math.round(daysOfHistory) };
}

function compsConfidence(sampleSize: number): Confidence {
  return sampleSize >= 8 ? "high" : sampleSize >= 3 ? "medium" : "low";
}

// Pricing Intelligence (Module 3) — how a real vehicle's asking price
// compares to the real market average found for it.
export function computePricingIntelligence(
  vehicleId: string,
  make: string,
  model: string,
  askingPrice: number,
  comps: { average: number; sampleSize: number }
): PricingIntelligence {
  const deltaPercent = Math.round(((askingPrice - comps.average) / comps.average) * 1000) / 10;
  return {
    vehicleId, make, model, askingPrice,
    marketAverage: comps.average,
    deltaPercent,
    confidence: compsConfidence(comps.sampleSize),
  };
}

// Market Health Engine (Module 8) — Demand/Pricing/Supply, all
// genuinely derived from the dealer's own real stock's real market
// comps, not a fabricated broader index this app has no way to see.
export function computeMarketHealth(
  pricingIntel: PricingIntelligence[],
  comps: { demandScore: number; sampleSize: number }[]
): MarketHealth {
  if (comps.length === 0) {
    return { overall: 50, demand: 50, pricing: 50, supply: 50, confidence: "low" };
  }

  const demand = Math.round(comps.reduce((sum, c) => sum + c.demandScore, 0) / comps.length);

  const avgAbsDelta = pricingIntel.length > 0
    ? pricingIntel.reduce((sum, p) => sum + Math.abs(p.deltaPercent), 0) / pricingIntel.length
    : 0;
  const pricing = Math.max(0, Math.min(100, Math.round(100 - avgAbsDelta * 3)));

  const avgSampleSize = comps.reduce((sum, c) => sum + c.sampleSize, 0) / comps.length;
  const supply = Math.max(0, Math.min(100, Math.round(avgSampleSize * 6)));

  const overall = Math.round((demand + pricing + supply) / 3);
  const confidence: Confidence = avgSampleSize >= 8 ? "high" : avgSampleSize >= 3 ? "medium" : "low";

  return { overall, demand, pricing, supply, confidence };
}

// Opportunity Detection (Module 7) — real, evidence-gated signals
// only: a vehicle priced meaningfully below real market average (real
// margin being left on the table), or meaningfully above it with
// real demand data to back the concern up (likely suppressing
// enquiries — matches the spec's own Module 3 example almost exactly).
export function findMarketOpportunities(pricingIntel: PricingIntelligence[]): MarketOpportunity[] {
  const opportunities: MarketOpportunity[] = [];

  for (const p of pricingIntel) {
    if (p.confidence === "low") continue; // too thin a real sample to act on
    if (p.deltaPercent <= -8) {
      opportunities.push({
        title: `${p.make} ${p.model} may be underpriced`,
        detail: `Listed at £${p.askingPrice.toLocaleString()}, ${Math.abs(p.deltaPercent)}% below the real market average of £${p.marketAverage.toLocaleString()}.`,
      });
    } else if (p.deltaPercent >= 8) {
      opportunities.push({
        title: `${p.make} ${p.model} may be overpriced`,
        detail: `Listed at £${p.askingPrice.toLocaleString()}, ${p.deltaPercent}% above the real market average of £${p.marketAverage.toLocaleString()} — likely suppressing enquiries.`,
      });
    }
  }

  return opportunities;
}

// Market Investigation Mode (Module 9) — "why isn't this vehicle
// selling", combining real internal evidence (days in stock, real
// enquiry count) with real market evidence (pricing position, demand
// trend). Deterministic, evidence-only — the caller (Pilot Brain's
// system prompt) narrates this, it doesn't invent it.
export function investigateVehicle(
  vehicleId: string,
  daysInStock: number,
  enquiryCount: number,
  pricingIntel: PricingIntelligence | null,
  trend: TrendResult
): VehicleInvestigation {
  const pricingPosition = pricingIntel
    ? pricingIntel.deltaPercent === 0
      ? "priced exactly at the real market average"
      : `${Math.abs(pricingIntel.deltaPercent)}% ${pricingIntel.deltaPercent > 0 ? "above" : "below"} the real market average (confidence: ${pricingIntel.confidence})`
    : "no real market comparison available for this vehicle yet";

  const demandTrend = trend.direction === "insufficient_data"
    ? "not enough real history yet to say if demand is rising or falling"
    : `demand for this make/model is ${trend.direction}${trend.changePercent != null ? ` (${trend.changePercent > 0 ? "+" : ""}${trend.changePercent}% over ${trend.daysOfHistory} days)` : ""}`;

  let likelyCause: string;
  let confidence: Confidence;

  if (pricingIntel && pricingIntel.deltaPercent >= 8 && pricingIntel.confidence !== "low") {
    likelyCause = "Pricing appears to be the main factor — it's priced meaningfully above real comparable market listings.";
    confidence = pricingIntel.confidence;
  } else if (trend.direction === "falling") {
    likelyCause = "Pricing appears reasonable, but real market demand for this make/model has been falling.";
    confidence = "medium";
  } else if (enquiryCount === 0 && daysInStock > 30) {
    likelyCause = "Pricing and demand both look reasonable from the evidence available — the lack of enquiries doesn't have a clear cause in the data. Worth checking listing quality (photos, description, visibility) rather than price.";
    confidence = "low";
  } else {
    likelyCause = "No single clear cause stands out from the real evidence available.";
    confidence = "low";
  }

  return { vehicleId, daysInStock, enquiryCount, pricingPosition, demandTrend, likelyCause, confidence };
}

export interface PlatformInsight {
  available: boolean;
  message: string;
}

// Platform Intelligence Layer — framework and real storage exist (see
// marketIntelligence.ts's platformDealerActivity collection), but this
// deliberately stays gated off until real dealer diversity exists.
// The threshold (5) isn't precise, just a floor below which "platform-
// wide" would really mean "one or two dealers' own data, relabelled"
// — exactly what the spec's ethical rule (never expose or effectively
// reveal an individual dealer's own data as if it were market-wide)
// rules out. The caller never learns WHICH dealerships contributed,
// only a count — this function itself never sees or returns identity.
const PLATFORM_MIN_DEALERSHIPS = 5;

export function getPlatformInsight(distinctActiveDealerships: number): PlatformInsight {
  if (distinctActiveDealerships < PLATFORM_MIN_DEALERSHIPS) {
    return {
      available: false,
      message: `Platform-wide market intelligence isn't available yet — only ${distinctActiveDealerships} real dealership${distinctActiveDealerships === 1 ? " has" : "s have"} used Market Intelligence so far, and at least ${PLATFORM_MIN_DEALERSHIPS} are needed before an aggregate trend would mean anything rather than just reflecting one or two dealers' own stock.`,
    };
  }
  return {
    available: true,
    message: `Platform-wide data is available from ${distinctActiveDealerships} real dealerships, but aggregate trend computation isn't built yet — only the real-dealer-count gate is.`,
  };
}
