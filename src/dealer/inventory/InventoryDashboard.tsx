import { useInventory } from "@/context/InventoryProvider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { useNavigate } from "react-router-dom";

export default function InventoryDashboard() {
  const { vehicles } = useInventory();
  const navigate = useNavigate();

  // -----------------------------
  // REAL INVENTORY SIGNALS
  // -----------------------------

  const totalVehicles = vehicles.length;

  const motAlerts = vehicles.filter((v) => {
    const expiry = v.mot?.expiry;
    if (!expiry) return false;
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    return days <= 30;
  });

  const reconNeeded = vehicles.filter(
    (v) => (v.predictedRepairs?.length ?? 0) > 0
  );

  const pricingNeeded = vehicles.filter(
    (v) => (v.valuationConfidence ?? 100) < 60
  );

  // Real photo count, not `photoQuality` — see DealerDashboard.tsx for
  // why that field is fake and never reflects real uploaded photos.
  const photoNeeded = vehicles.filter(
    (v) => (v.images?.length ?? 0) === 0
  );

  const financeIssues = vehicles.filter(
    (v) => (v.auctionDelta ?? 0) > 20
  );

  // -----------------------------
  // SUMMARY STATS
  // -----------------------------

  const stats = [
    { label: "Total Vehicles", value: totalVehicles },
    { label: "MOT Alerts", value: motAlerts.length },
    { label: "Recon Needed", value: reconNeeded.length },
    { label: "Pricing Needed", value: pricingNeeded.length },
    { label: "Photos Needed", value: photoNeeded.length },
    { label: "Finance Risks", value: financeIssues.length },
  ];

  return (
    <div className="animate-fadeIn relative z-10 p-10 text-white">

      {/* HEADER */}
      <SupernovaHeroHeader
        title="Inventory Dashboard"
        subtitle="Your stock, prep, listing and workflow overview."
      />

      {/* SUMMARY */}
      <SupernovaSectionDivider label="Inventory Summary" />

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
        {stats.map((s) => (
          <SupernovaGlowCard key={s.label}>
            <h2 className="text-yellow-400 font-bold text-xl">{s.label}</h2>
            <div className="text-3xl font-bold text-yellow-500 mt-2">
              {s.value}
            </div>
          </SupernovaGlowCard>
        ))}
      </section>

      {/* QUICK ACTIONS */}
      <SupernovaSectionDivider label="Quick Actions" />

      <SupernovaGlowCard>
        <h2 className="text-blue-400 font-bold text-xl mb-4">Actions</h2>

        <div className="flex flex-wrap gap-4">

          <button
            onClick={() => navigate("/new-flip")}
            className="px-5 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition"
          >
            Add Vehicle
          </button>

          <button
            onClick={() => navigate("/dealer/tools")}
            className="px-5 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition"
          >
            Scan VIN
          </button>

          <button
            onClick={() => navigate("/dealer/risk")}
            className="px-5 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition"
          >
            Run Risk Check
          </button>

          <button
            onClick={() => navigate("/dealer/inventory/list")}
            className="px-5 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition"
          >
            View Vehicle List
          </button>

          <button
            onClick={() => navigate("/dealer/inventory/mot-lookup")}
            className="px-5 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition"
          >
            MOT Lookup
          </button>

          <button
            onClick={() => navigate("/dealer/inventory/parts-labour")}
            className="px-5 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition"
          >
            Parts & Labour Log
          </button>

        </div>
      </SupernovaGlowCard>

      {/* ANALYTICS PREVIEW */}
      <SupernovaSectionDivider label="Analytics Preview" />

      <SupernovaGlowCard>
        <h2 className="text-red-400 font-bold text-xl mb-3">Market Analytics</h2>
        <p className="text-white/70">
          Market trends, pricing intelligence, and risk indicators will appear here once engines are rebuilt.
        </p>
      </SupernovaGlowCard>

    </div>
  );
}