import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useInventory } from "@/context/InventoryProvider";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { useIntelligence } from "@/context/IntelligenceProvider";
import { fetchEbayCarComps, type EbayCarComps } from "@/lib/ebayCarComps";
import { fetchGooglePriceGuide, type GoogleCarPriceGuide } from "@/lib/googlePriceGuide";

import CostsTab from "@/bookkeeping/vehicles/CostsTab";
import ProfitTab from "@/bookkeeping/vehicles/ProfitTab";
import EditVehicle from "@/bookkeeping/vehicles/EditVehicle";
import MOTWorkflow from "@/dealer/workflow/MOTWorkflow";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

import { CosmicIdentityBlock } from "@/features/dealer-ai/vehicle/CosmicIdentityBlock";
import { BuyOrWalkPanel } from "@/features/dealer-ai/buy-or-walk/BuyOrWalkPanel";
import { FlipScorePanel } from "@/features/dealer-ai/flip-score/FlipScorePanel";
import { PredictiveMaintenancePanel } from "@/features/dealer-ai/predictive/PredictiveMaintenancePanel";
import { MarketIntelligencePanel } from "@/features/dealer-ai/market/MarketIntelligencePanel";
import { DealerNegotiationPanel } from "@/features/dealer-ai/negotiation/DealerNegotiationPanel";

import { motAiEngine } from "@/engines/motAiEngine";
import { getUlezStatus } from "@/features/vehicles/utils/ulezUtils";
import { normalizeFlipRecord } from "@/features/vehicles/models/FlipRecord";


import type { Vehicle } from "@/types/Vehicle";

export default function VehicleOverview() {
  const navigate = useNavigate();
  const { id } = useParams();
  const vehicleId = id as string;

  const { vehicles: invVehicles } = useInventory();
  const { purchases, sales } = useBookkeeping();
  const { flipScores, marketIntel, motHealth } = useIntelligence();

  const vehicle = invVehicles.find((v: Vehicle) => String(v.id) === vehicleId);

  const purchase = purchases.find((p) => p.vehicleId === vehicleId);
  const sale = sales.find((s) => s.vehicleId === vehicleId);

  const [tab, setTab] = useState<
    "overview" | "mot" | "dealer-ai" | "costs" | "profit" | "edit"
  >("overview");

  // Real dealer-only, same-year, mileage-comparable eBay listings for
  // this exact vehicle (see backend/src/ebayCarMarket.ts) — fetched
  // once per vehicle rather than blocking the tab on it, since it's an
  // external API call. Starts null (not yet fetched / still loading);
  // stays null forever when eBay isn't configured or no comparable
  // dealer listings exist, in which case every panel below just keeps
  // using the existing simulated estimate — never blocks, never fakes
  // a result. Has to live above the `!vehicle` guard below along with
  // every other hook in this component — a hook called only when
  // `vehicle` exists would violate the Rules of Hooks the instant a
  // vehicle id stops resolving between renders.
  const [ebayComps, setEbayComps] = useState<EbayCarComps | null>(null);
  useEffect(() => {
    setEbayComps(null);
    if (!vehicle?.make || !vehicle?.model) return;
    let cancelled = false;
    fetchEbayCarComps(
      vehicle.make,
      vehicle.model,
      vehicle.mot?.year ?? null,
      vehicle.mileage ?? vehicle.mot?.mileage ?? null
    )
      .then((res) => {
        if (!cancelled && res.available && res.comps) setEbayComps(res.comps);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicle?.id, vehicle?.make, vehicle?.model, vehicle?.mot?.year, vehicle?.mileage]);

  // Google dealer-price cross-reference — deliberately NOT auto-fetched
  // like the eBay comps above; only runs when the dealer clicks "Check
  // Google dealer prices" (see handleCheckGooglePrices below). The
  // shared SerpAPI quota behind this (100 searches/month, split with
  // flippilotlatest's own price lookups) can't support fetching this on
  // every vehicle page view the way eBay's much larger free tier can.
  const [googleGuide, setGoogleGuide] = useState<GoogleCarPriceGuide | null>(null);
  const [googleGuideStatus, setGoogleGuideStatus] = useState<"idle" | "loading" | "not-found">("idle");

  useEffect(() => {
    setGoogleGuide(null);
    setGoogleGuideStatus("idle");
  }, [vehicle?.id]);

  if (!vehicle) {
    return (
      <div className="p-10 text-white">
        <h2 className="text-2xl font-bold text-red-400">Vehicle Not Found</h2>
        <p className="text-white/60 mt-2">
          This vehicle does not exist in your inventory or bookkeeping records.
        </p>
      </div>
    );
  }

  const mot = vehicle.mot;
  const ai = mot ? motAiEngine(mot, mot.history ?? []) : null;
  const ulez = getUlezStatus(mot?.fuelType, mot?.euroStatus);

  async function handleCheckGooglePrices() {
    if (!vehicle || !vehicle.make || !vehicle.model) return;
    setGoogleGuideStatus("loading");
    const res = await fetchGooglePriceGuide(
      vehicle.make,
      vehicle.model,
      mot?.year ?? null,
      vehicle.mileage ?? mot?.mileage ?? null
    );
    if (res.available && res.guide) {
      setGoogleGuide(res.guide);
      setGoogleGuideStatus("idle");
    } else {
      setGoogleGuide(null);
      setGoogleGuideStatus("not-found");
    }
  }

  const motStatus = (() => {
    if (!mot?.expiry) return "Unknown";
    const exp = new Date(mot.expiry);
    const now = new Date();
    if (exp < now) return "Expired";
    const days = (exp.getTime() - now.getTime()) / 86400000;
    return days < 30 ? "Expiring Soon" : "Valid";
  })();

  const failures = mot?.history
    ? mot.history
        .filter((h) => h.result?.toUpperCase() === "FAIL")
        .flatMap((h) => h.failures ?? [])
    : [];

  const advisories = mot?.advisories ?? [];

  // The Dealer AI tab's panels (Buy-or-Walk, Flip Score, Predictive
  // Maintenance, Market Intelligence, Negotiation) all read a
  // FlipRecord-shaped `vehicle` prop expecting real make/model/mileage/
  // mot/flipScore/market/aiValuation/aiPrice fields — this object used
  // to supply only id/title/buyPrice/sellPrice/timestamp/
  // valuationHistory, so every one of those reads silently fell back to
  // its default (0 mileage, 0 MOT failures regardless of the real
  // vehicle, £0 valuation) and every vehicle showed the exact same
  // "WALK AWAY" verdict. Real per-vehicle intelligence already exists
  // via useIntelligence() (same source the dashboard HUD and AI
  // Insights use) — wired in here instead of leaving it all undefined.
  // normalizeFlipRecord fills in any field this doesn't set with a
  // real (null, not fabricated) default rather than crashing on a
  // missing nested object.
  const vehicleIntel = marketIntel[vehicleId] as
    | { marketAvg?: number; demandIndex?: number; competitorCount?: number }
    | undefined;
  const marketAvg = vehicleIntel?.marketAvg ?? vehicle.priceRetail ?? vehicle.priceTrade ?? undefined;

  const dealerAIVehicle = normalizeFlipRecord({
    id: vehicle.id,
    title: `${vehicle.make} ${vehicle.model}`,
    make: vehicle.make,
    model: vehicle.model,
    buyPrice: purchase?.purchasePrice ?? vehicle.priceTrade ?? 0,
    sellPrice: sale?.salePrice ?? vehicle.priceRetail ?? 0,
    price: vehicle.priceRetail ?? vehicle.priceTrade ?? null,
    valuation: vehicle.priceRetail ?? vehicle.priceTrade ?? null,
    mileage: vehicle.mileage ?? mot?.mileage ?? null,
    timestamp: purchase?.date ?? "",
    valuationHistory: vehicle.depreciationCurve.map((value, index) => ({
      date: `${2020 + index}-01-01`,
      value,
    })),
    flipScore: flipScores[vehicleId] ?? vehicle.flipDifficulty ?? null,
    ai: { conditionScore: (motHealth[vehicleId] ?? ai)?.healthScore ?? null },
    mot: {
      year: mot?.year ?? null,
      mileage: mot?.mileage ?? vehicle.mileage ?? null,
      failures,
      advisories,
    },
    // Real eBay comps (dealer-only, same year, mileage-comparable) take
    // priority over the simulated estimate whenever they're available —
    // same "prefer the real signal when we have one, keep the honest
    // simulated fallback when we don't" shape as the rest of this app.
    market: ebayComps
      ? {
          demandScore: ebayComps.demandScore,
          lowest: ebayComps.lowest,
          highest: ebayComps.highest,
          average: ebayComps.average,
          soldCount: ebayComps.soldCount,
        }
      : {
          demandScore: vehicleIntel?.demandIndex ?? null,
          lowest: marketAvg != null ? Math.round(marketAvg * 0.85) : null,
          highest: marketAvg != null ? Math.round(marketAvg * 1.15) : null,
          average: marketAvg ?? null,
          soldCount: vehicleIntel?.competitorCount ?? null,
        },
    aiValuation: {
      estimatedValue: vehicle.priceRetail ?? vehicle.priceTrade ?? null,
      confidence: vehicle.valuationConfidence ?? null,
    },
    aiPrice: {
      recommendedSellPrice: vehicle.priceRetail ?? null,
      riskLevel: (motHealth[vehicleId] ?? ai)?.riskLevel ?? null,
    },
  });

  return (
    <div className="p-6 text-white animate-fadeIn">
      <SupernovaHeroHeader
        title={`${vehicle.make} ${vehicle.model}`}
        subtitle={`Record ID: ${vehicleId}`}
      />

      {/* TABS */}
      <div data-tour="tour-vehicle-tabs" className="flex flex-wrap gap-3 mb-6">
        {["overview", "mot", "dealer-ai", "costs", "profit", "edit"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-4 py-2 rounded-xl transition font-bold ${
              tab === t
                ? "bg-yellow-400 text-black"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="space-y-10">
          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Vehicle Snapshot" />
            <p><span className="text-white/60">Make:</span> {vehicle.make}</p>
            <p><span className="text-white/60">Model:</span> {vehicle.model}</p>
            <p><span className="text-white/60">Year:</span> {vehicle.year ?? "N/A"}</p>
            <p><span className="text-white/60">Mileage:</span> {vehicle.mileage ?? "N/A"}</p>
            <p><span className="text-white/60">Market Heat:</span> {vehicle.marketHeat}</p>
            <p><span className="text-white/60">Risk Score:</span> {vehicle.riskScore}</p>

            {/* ⭐ MOT SUMMARY */}
            {mot && (
              <>
                <p>
                  <span className="text-white/60">MOT Status:</span>{" "}
                  <span
                    className={
                      motStatus === "Expired"
                        ? "text-red-400"
                        : motStatus === "Expiring Soon"
                        ? "text-orange-300"
                        : "text-green-300"
                    }
                  >
                    {motStatus}
                  </span>
                </p>

                <p>
                  <span className="text-white/60">MOT Expiry:</span>{" "}
                  {mot.expiry ?? "Unknown"}
                </p>

                {ai && (
                  <p>
                    <span className="text-white/60">MOT Health Score:</span>{" "}
                    <span
                      className={
                        ai.riskLevel === "low"
                          ? "text-green-300"
                          : ai.riskLevel === "medium"
                          ? "text-yellow-300"
                          : "text-red-400"
                      }
                    >
                      {ai.healthScore}%
                    </span>
                  </p>
                )}

                <p>
                  <span className="text-white/60">Advisories:</span>{" "}
                  {advisories.length}
                </p>

                <p>
                  <span className="text-white/60">Failures:</span>{" "}
                  {failures.length}
                </p>

                <p>
                  <span className="text-white/60">ULEZ/CAZ:</span>{" "}
                  <span
                    className={
                      ulez.status === "compliant"
                        ? "text-green-300"
                        : ulez.status === "non-compliant"
                        ? "text-red-400"
                        : "text-white/40"
                    }
                  >
                    {ulez.label}
                  </span>
                </p>
              </>
            )}
          </SupernovaGlowCard>

          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Purchase / Sale" />
            <p>
              <span className="text-white/60">Purchase Price:</span>{" "}
              £{(purchase?.purchasePrice ?? vehicle.priceTrade ?? 0).toLocaleString()}
            </p>
            <p>
              <span className="text-white/60">Expected Sale:</span>{" "}
              £{(sale?.salePrice ?? vehicle.priceRetail ?? 0).toLocaleString()}
            </p>
          </SupernovaGlowCard>

          <div className="flex gap-4">
            <button
              onClick={() => setTab("mot")}
              className="px-4 py-2 bg-blue-500 text-black rounded-xl font-bold hover:bg-blue-400"
            >
              Full MOT History
            </button>

            <button
              onClick={() => navigate(`/dealer/workflow/recon/${vehicleId}`)}
              className="px-4 py-2 bg-green-500 text-black rounded-xl font-bold hover:bg-green-400"
            >
              Recon Workflow
            </button>
          </div>
        </div>
      )}

      {/* MOT TAB */}
      {tab === "mot" && <MOTWorkflow />}

      {/* DEALER AI TAB */}
      {tab === "dealer-ai" && (
        <div className="space-y-10">
          <CosmicIdentityBlock vehicle={dealerAIVehicle} />

          {/* Market Pricing — the eBay guide price and Google
              cross-reference used to sit here as two separate banners;
              combined into one card since they're answering the same
              question ("what's this actually worth?") from two
              different real sources, not two different concerns. */}
          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Market Pricing" />
            <div className="space-y-4">
              <div>
                <p className="text-white/60 text-sm mb-1">eBay Dealer Comps</p>
                <p className="text-white/80 text-sm">
                  {ebayComps
                    ? (() => {
                        const qualifiers = [
                          ebayComps.yearFiltered ? "same year" : null,
                          ebayComps.mileageFiltered ? "mileage-comparable" : null,
                        ].filter((q): q is string => q !== null);
                        // A single real listing has no real "range" — a
                        // literal "£1,895 – £1,895" range with an
                        // identical average was confirmed live on the
                        // Fiat 500 (1 listing survived filtering), which
                        // just looks like a display bug even though the
                        // underlying number is genuinely correct.
                        const priceText =
                          ebayComps.soldCount === 1
                            ? `Guide price £${ebayComps.average.toLocaleString()}`
                            : `Guide price £${ebayComps.lowest.toLocaleString()} – £${ebayComps.highest.toLocaleString()} (avg £${ebayComps.average.toLocaleString()})`;
                        return `${priceText} — from ${ebayComps.soldCount} real eBay dealer listing${ebayComps.soldCount === 1 ? " (a single comp — treat as a rough steer, not a confident range)" : "s"}${qualifiers.length ? ` (${qualifiers.join(", ")})` : " (year/mileage unconfirmed from listing titles)"}. These are asking prices a seller set to sell quickly, not confirmed sale prices — real retail value may run higher.`;
                      })()
                    : "Simulated estimate — no comparable eBay dealer listings found for this exact year/model yet."}
                </p>
              </div>

              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
                  <p className="text-white/60 text-sm">Google Dealer/Comparison Sites</p>
                  <button
                    onClick={handleCheckGooglePrices}
                    disabled={googleGuideStatus === "loading"}
                    className="px-3 py-1.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/50 hover:bg-blue-500/30 text-xs font-semibold disabled:opacity-50"
                  >
                    {googleGuideStatus === "loading" ? "Checking…" : "Check Google Dealer Prices"}
                  </button>
                </div>
                {googleGuide && (
                  <p className="text-white/80 text-sm">
                    {googleGuide.sourceCount === 1
                      ? `Guide price £${googleGuide.average.toLocaleString()}`
                      : `Guide price £${googleGuide.lowest.toLocaleString()} – £${googleGuide.highest.toLocaleString()} (avg £${googleGuide.average.toLocaleString()})`}
                    {" "}— from {googleGuide.sourceCount} real price mention{googleGuide.sourceCount === 1 ? " (a single mention — treat as a rough steer, not a confident range)" : "s"}
                    {googleGuide.sources.length ? ` across ${googleGuide.sources.join(", ")}` : ""}.
                  </p>
                )}
                {googleGuideStatus === "not-found" && (
                  <p className="text-white/50 text-sm">No usable dealer price mentions found for this search.</p>
                )}
                {googleGuideStatus === "idle" && !googleGuide && (
                  <p className="text-white/40 text-sm">AutoTrader, Cazoo, AutoUncle, Parkers and others — click to cross-reference.</p>
                )}
              </div>
            </div>
          </SupernovaGlowCard>

          <BuyOrWalkPanel vehicle={dealerAIVehicle} />
          <FlipScorePanel vehicle={dealerAIVehicle} />
          <PredictiveMaintenancePanel vehicle={dealerAIVehicle} />
          <MarketIntelligencePanel vehicle={dealerAIVehicle} />
          <DealerNegotiationPanel vehicle={dealerAIVehicle} />
        </div>
      )}

      {/* COSTS TAB */}
      {tab === "costs" && <CostsTab vehicleId={vehicleId} />}

      {/* PROFIT TAB */}
      {tab === "profit" && (
        <ProfitTab
          vehicleId={vehicleId}
          purchasePrice={purchase?.purchasePrice ?? vehicle.priceTrade ?? 0}
          expectedSale={sale?.salePrice ?? vehicle.priceRetail ?? 0}
        />
      )}

      {/* EDIT TAB */}
      {tab === "edit" && <EditVehicle vehicleId={vehicleId} />}
    </div>
  );
}
