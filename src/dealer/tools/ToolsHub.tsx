import { useState } from "react";
import { decodeVIN } from "../../engines/VinDecoder";
import { optimiseStock } from "../../engines/StockOptimizer";

import { SupernovaGlowCard } from "../../components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "../../components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "../../components/supernova/SupernovaSectionDivider";
import { SupernovaInput } from "../../components/supernova/SupernovaInput";
import { SupernovaGlowButton } from "../../components/supernova/SupernovaGlowButton";

export default function ToolsHub() {
  // VIN Scanner state
  const [vin, setVin] = useState("");
  const [result, setResult] = useState<any>(null);

  function handleScan() {
    const decoded = decodeVIN(vin);
    setResult(decoded);
  }

  // Engine-powered stock optimisation
  const stock = [
    { name: "Fiesta", daysInStock: 12 },
    { name: "Corsa", daysInStock: 52 },
    { name: "Focus", daysInStock: 33 },
  ];

  const optimised = optimiseStock(stock);

  return (
    <div className="min-h-screen bg-[#0A1128] text-white p-10 animate-fadeIn">

      {/* HEADER */}
      <SupernovaHeroHeader
        title="Tools Command Center"
        subtitle="FlipPilot Dealer OS • Supernova V12"
      />

      {/* BADGE */}
      <div className="mb-10">
        <span className="inline-block px-4 py-2 bg-black/40 border border-yellow-400 rounded-lg text-yellow-300 text-sm">
          Unified Tools Hub • AI • Photo • Vehicle • Dealer Ops
        </span>
      </div>

      {/* GRID */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-10">

        {/* VEHICLE MANAGEMENT */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">Vehicle Management</h2>
          <div className="flex flex-col gap-3 text-white/70">

            <a
              href="/vehicles/new"
              className="px-4 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-300 transition"
            >
              Add Vehicle
            </a>

            <a
              href="/vehicles/list"
              className="px-4 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-300 transition"
            >
              Vehicle List
            </a>

            <a
              href="/vehicles/overview/123"
              className="px-4 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-300 transition"
            >
              Vehicle Overview
            </a>

            <a
              href="/vehicles/edit/123"
              className="px-4 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-300 transition"
            >
              Edit Vehicle
            </a>

          </div>
        </SupernovaGlowCard>

        {/* VIN SCANNER */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">VIN Scanner</h2>

          <SupernovaInput
            label="VIN"
            value={vin}
            onChange={setVin}
            placeholder="Enter VIN (17 characters)"
          />

          <div className="mt-4">
            <SupernovaGlowButton label="Scan VIN" onClick={handleScan} />
          </div>

          {result && (
            <div className="mt-4 text-white/70 text-sm space-y-1">
              <p><strong>Make:</strong> {result.make}</p>
              <p><strong>Model:</strong> {result.model}</p>
              <p><strong>Year:</strong> {result.year}</p>
              <p><strong>Body:</strong> {result.body}</p>
              <p><strong>Engine:</strong> {result.engine}</p>
              <p><strong>Demand:</strong> {result.marketDemand}</p>
              <p><strong>Profit:</strong> £{result.estimatedProfit}</p>
              <p><strong>Mileage:</strong> {result.mileage}</p>
            </div>
          )}
        </SupernovaGlowCard>

        {/* STOCK OPTIMISER */}
        <SupernovaGlowCard>
          <h2 className="text-red-400 font-bold text-xl mb-3">Stock Optimiser</h2>
          <p className="text-white/70">
            Slow movers: {optimised.slow.length}  
            <br />
            Fast movers: {optimised.fast.length}
          </p>
        </SupernovaGlowCard>

        {/* PRICE ESTIMATOR */}
        <SupernovaGlowCard>
          <h2 className="text-blue-400 font-bold text-xl mb-3">AI Price Estimator</h2>
          <p className="text-white/70">
            Get instant AI‑powered valuation estimates.
          </p>
        </SupernovaGlowCard>

        {/* MARKET LOOKUP */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">Market Lookup</h2>
          <p className="text-white/70">
            Check live market trends and pricing.
          </p>
        </SupernovaGlowCard>

        {/* DEALER UTILITIES */}
        <SupernovaGlowCard>
          <h2 className="text-red-400 font-bold text-xl mb-3">Dealer Utilities</h2>
          <p className="text-white/70">
            Tools for admin, exports, and daily operations.
          </p>
        </SupernovaGlowCard>

        {/* PHOTO STUDIO */}
        <SupernovaGlowCard>
          <h2 className="text-blue-400 font-bold text-xl mb-3">Photo Studio</h2>
          <p className="text-white/70">
            AI background remover, enhancer, damage detection, and listing generator.
          </p>
        </SupernovaGlowCard>

        {/* QUICK TOOLS */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">Quick Tools</h2>
          <p className="text-white/70">
            Barcode scanner, boot fair tools, lookup utilities.
          </p>
        </SupernovaGlowCard>

        {/* MARKETPLACE TOOLS */}
        <SupernovaGlowCard>
          <h2 className="text-blue-400 font-bold text-xl mb-3">Marketplace Tools</h2>
          <p className="text-white/70">
            Ranking Brain, Pricing Brain, market intelligence.
          </p>
        </SupernovaGlowCard>

        {/* DEALER OPS */}
        <SupernovaGlowCard>
          <h2 className="text-red-400 font-bold text-xl mb-3">Dealer Operations</h2>
          <p className="text-white/70">
            Staff tools, finance tools, risk tools, workflow utilities.
          </p>
        </SupernovaGlowCard>

      </section>

      {/* COMING SOON */}
      <SupernovaSectionDivider label="Upcoming Tools" />

      <SupernovaGlowCard>
        <h2 className="text-blue-400 font-bold text-xl mb-3">Coming Soon</h2>
        <ul className="space-y-3 text-white/70">
          <li>• Auction bidding assistant</li>
          <li>• AI buying strategy generator</li>
          <li>• Dealer performance optimiser</li>
          <li>• Vehicle photo AI enhancer</li>
          <li>• Instant retail pricing engine</li>
        </ul>
      </SupernovaGlowCard>

    </div>
  );
}
