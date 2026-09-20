import { useInventory } from "@/context/InventoryProvider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { useNavigate } from "react-router-dom";
import {
  inStockAtLeast,
  motCounts,
  unsold,
  withMotAdvisories,
  withoutAskingPrice,
  withoutPhotos,
} from "./stockFacts";

export default function InventoryDashboard() {
  const { vehicles } = useInventory();
  const navigate = useNavigate();

  // -----------------------------
  // REAL INVENTORY SIGNALS
  // -----------------------------
  //
  // Counted from the dealer's own cars that are still unsold (see
  // stockFacts.ts). This dashboard used to show "Pricing Needed" (a
  // "valuation confidence" that FELL as the dealer's margin rose, so it flagged
  // the best-margin cars), "Recon Needed" (the guessed repairs table), and
  // "Finance Risks" (an "auction delta" that was 12 for every car, so it never
  // fired). They are replaced by plain rules a dealer can check by hand.

  const now = new Date();
  const inStock = unsold(vehicles);
  const mot = motCounts(vehicles, now);

  const stats = [
    { label: "Cars in Stock", value: inStock.length },
    { label: "MOT Expired or Due in 30 Days", value: mot.expired + mot.dueSoon },
    { label: "With MOT Advisories", value: withMotAdvisories(vehicles).length },
    { label: "No Asking Price Set", value: withoutAskingPrice(vehicles).length },
    { label: "In Stock 90+ Days", value: inStockAtLeast(vehicles, 90, now).length },
    { label: "Photos Needed", value: withoutPhotos(vehicles).length },
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

      {/* ANALYTICS */}
      <SupernovaSectionDivider label="Analytics" />

      <SupernovaGlowCard>
        <h2 className="text-blue-400 font-bold text-xl mb-3">Stock, Sales and Lead Figures</h2>
        <p className="text-white/70 mb-4">
          MOT dates, prices, mileage and how long cars have been in stock, all counted from your own records.
        </p>
        <button
          onClick={() => navigate("/dealer/analytics")}
          className="px-5 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition"
        >
          Open Analytics
        </button>
      </SupernovaGlowCard>

    </div>
  );
}