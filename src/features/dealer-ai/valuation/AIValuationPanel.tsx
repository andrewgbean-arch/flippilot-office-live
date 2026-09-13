import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

import { useInventory } from "@/context/InventoryProvider";
import { useIntelligence } from "@/context/IntelligenceProvider";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

export default function AIValuationPanel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { vehicles } = useInventory();
  const { flipScores, riskScores } = useIntelligence();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) {
    return (
      <div className="text-white p-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/70 hover:text-white transition mb-6"
        >
          <FiArrowLeft /> Back
        </button>
        <p>Vehicle not found.</p>
      </div>
    );
  }

  /* -------------------------------------------------------
     ⭐ AI Valuation Logic
     "Volatility" used to be Math.random() * 30 — a different number on
     every single render regardless of the vehicle. Replaced with a
     deterministic estimate from age + mileage (older/higher-mileage
     stock genuinely does swing in value more), and risk/flipScore now
     come from IntelligenceProvider's real per-vehicle scoring instead
     of a local re-derivation.
  ------------------------------------------------------- */
  const valuation = useMemo(() => {
    const age = new Date().getFullYear() - (vehicle.year ?? new Date().getFullYear());
    const mileage = vehicle.mileage ?? 60000;

    // Base value from age + mileage
    let base = 8000 - age * 300 - Math.floor(mileage / 5000) * 150;

    // Adjust for MOT expiry
    if (vehicle.mot?.expiry) {
      const exp = new Date(vehicle.mot.expiry);
      const now = new Date();
      const diff = exp.getTime() - now.getTime();
      const days = diff / (1000 * 60 * 60 * 24);

      if (days < 0) base -= 400;
      else if (days < 30) base -= 200;
    }

    // Adjust for flip score
    const flipScore = flipScores[vehicle.id] ?? 50;
    base += (flipScore - 50) * 20;

    // Trade / Retail / Quick sale ranges
    const trade = Math.max(500, base * 0.85);
    const retail = Math.max(500, base * 1.15);
    const quickSale = Math.max(500, base * 0.75);

    const risk = riskScores[vehicle.id] ?? Math.min(100, age * 5 + (mileage / 1000) * 2);

    // Volatility: older, higher-mileage stock is genuinely more prone to
    // value swings — deterministic, not random.
    const volatility = Math.min(100, Math.round(age * 4 + mileage / 4000));

    const recon = Math.max(150, age * 40 + (mileage / 10000) * 80);

    return {
      trade: Math.round(trade),
      retail: Math.round(retail),
      quickSale: Math.round(quickSale),
      risk: Math.round(risk),
      volatility,
      recon: Math.round(recon),
      flipScore,
    };
  }, [vehicle, flipScores, riskScores]);

  const profitColor = (profit: number) => {
    if (profit < 0) return "text-red-400";
    if (profit < 500) return "text-yellow-300";
    return "text-green-400";
  };

  return (
    <div className="text-white bg-[#0A1128] min-h-screen p-10 animate-fadeIn">
      {/* ⭐ Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/70 hover:text-white transition mb-6"
      >
        <FiArrowLeft /> Back
      </button>

      <SupernovaHeroHeader
        title={`AI Valuation: ${vehicle.make} ${vehicle.model}`}
        subtitle="Dealer AI • Market Intelligence Panel"
      />

      <div className="max-w-5xl mx-auto space-y-10">
        {/* ⭐ Valuation Summary */}
        <SupernovaSectionDivider label="Valuation Summary" />

        <SupernovaGlowCard>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-white/60 text-sm">Trade Value</p>
              <p className="text-yellow-300 font-bold text-xl">
                £{valuation.trade}
              </p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Retail Value</p>
              <p className="text-green-400 font-bold text-xl">
                £{valuation.retail}
              </p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Quick Sale</p>
              <p className="text-red-400 font-bold text-xl">
                £{valuation.quickSale}
              </p>
            </div>
          </div>
        </SupernovaGlowCard>

        {/* ⭐ Risk & Volatility */}
        <SupernovaSectionDivider label="Risk & Volatility" />

        <SupernovaGlowCard>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-white/60 text-sm">Risk Score</p>
              <p className="text-white font-bold text-xl">{valuation.risk}/100</p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Volatility</p>
              <p className="text-white font-bold text-xl">
                {valuation.volatility}/100
              </p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Recon Estimate</p>
              <p className="text-white font-bold text-xl">
                £{valuation.recon}
              </p>
            </div>
          </div>
        </SupernovaGlowCard>

        {/* ⭐ Flip Score */}
        <SupernovaSectionDivider label="Flip Score" />

        <SupernovaGlowCard>
          <p className="text-white text-xl font-bold">
            Flip Score: {valuation.flipScore}/100
          </p>
        </SupernovaGlowCard>

        {/* ⭐ Expected Profit */}
        <SupernovaSectionDivider label="Expected Profit" />

        <SupernovaGlowCard>
          <p className={`${profitColor(valuation.retail - (vehicle.buyPrice ?? 0))} text-xl font-bold`}>
            Expected Profit (Retail): £{valuation.retail - (vehicle.buyPrice ?? 0)}
          </p>
        </SupernovaGlowCard>
      </div>
    </div>
  );
}
