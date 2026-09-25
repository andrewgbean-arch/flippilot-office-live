import { useState } from "react";
import { fetchMarketCheck, type MarketCheckResult } from "@/lib/pilotBrainApi";

function healthColor(score: number): string {
  if (score >= 75) return "text-green-300 border-green-400/40";
  if (score >= 50) return "text-yellow-300 border-yellow-400/40";
  return "text-red-300 border-red-400/40";
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "text-green-300",
  medium: "text-yellow-300",
  low: "text-white/60",
};

// V4 (Market Intelligence) — unlike the Watcher card, this is NOT
// fetched automatically on mount. It fans out to several real eBay
// calls per check, so it only ever runs when Boss actually asks for
// it — a deliberate cost/consent boundary, not an oversight.
export default function PilotBrainMarketCard() {
  const [result, setResult] = useState<MarketCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  async function runCheck() {
    setLoading(true);
    const data = await fetchMarketCheck();
    setResult(data);
    setLoading(false);
    setChecked(true);
  }

  return (
    <div className="bg-black/20 border border-white/10 rounded-xl p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-yellow-300 font-bold text-lg">Pilot Brain — Market Intelligence</h2>
        {result && (
          <div className={`px-3 py-1 rounded-lg border text-sm font-bold ${healthColor(result.health.overall)}`}>
            {result.health.overall}/100
          </div>
        )}
      </div>

      {!checked && !loading && (
        <div>
          <p className="text-white/60 text-sm mb-3">
            Compares your real stock against real comparable dealer listings on eBay — pricing position, demand, and opportunities.
          </p>
          <button
            onClick={runCheck}
            className="px-4 py-2 rounded-lg font-semibold bg-yellow-400 text-black hover:bg-yellow-300 transition text-sm"
          >
            Check the Market
          </button>
        </div>
      )}

      {loading && <p className="text-white/60 text-sm">Checking real comparable listings — this fans out to a few real API calls, give it a moment…</p>}

      {checked && !loading && !result && (
        <p className="text-sm text-red-300">
          The market check couldn't run just now. It needs Pilot Brain on your plan; if you have it, try again in a minute.
        </p>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-black/30 rounded-lg p-2">
              <div className="text-white font-bold">{result.health.demand}</div>
              <div className="text-white/60 text-xs">Demand</div>
            </div>
            <div className="bg-black/30 rounded-lg p-2">
              <div className="text-white font-bold">{result.health.pricing}</div>
              <div className="text-white/60 text-xs">Pricing</div>
            </div>
            <div className="bg-black/30 rounded-lg p-2">
              <div className="text-white font-bold">{result.health.supply}</div>
              <div className="text-white/60 text-xs">Supply</div>
            </div>
          </div>

          {result.pricingIntel.length === 0 ? (
            <p className="text-white/50 text-sm">
              No real comparable dealer listings found for this stock right now — eBay genuinely has none for these specific makes/models at the moment. Not a bug, just how thin the real market is for this stock today.
            </p>
          ) : (
            <div className="space-y-1.5">
              {result.pricingIntel.map(p => (
                <div key={p.vehicleId} className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm flex items-center justify-between gap-2">
                  <span className="text-white/80">{p.make} {p.model}</span>
                  <span className={p.deltaPercent > 0 ? "text-orange-300" : p.deltaPercent < 0 ? "text-green-300" : "text-white/60"}>
                    {p.deltaPercent >= 0 ? "+" : ""}{p.deltaPercent}% vs market
                    <span className={`ml-1 text-xs ${CONFIDENCE_STYLE[p.confidence]}`}>({p.confidence})</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {result.opportunities.length > 0 && (
            <div className="space-y-1.5">
              {result.opportunities.map(o => (
                <div key={o.title} className="px-3 py-2 rounded-lg border border-blue-400/40 bg-blue-500/10 text-blue-200 text-sm">
                  <span className="font-semibold">{o.title}:</span> {o.detail}
                </div>
              ))}
            </div>
          )}

          <p className="text-white/60 text-xs">{result.platformInsight.message}</p>

          <button
            onClick={runCheck}
            className="text-xs text-white/60 hover:text-white/70 transition"
          >
            Check again
          </button>
        </div>
      )}
    </div>
  );
}
