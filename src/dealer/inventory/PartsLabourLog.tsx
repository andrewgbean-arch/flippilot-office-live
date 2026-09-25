import { useState } from "react";
import { useInventory } from "@/context/InventoryProvider";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import VehiclePicker from "@/bookkeeping/VehiclePicker";
import AddCostModal from "@/bookkeeping/AddCostModal";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { formatMoney } from "@/lib/formatMoney";

// This page used to be a hardcoded placeholder ("Welcome to your dealer
// inventory... We will connect your storage next", 0 everywhere) that
// wasn't even the file the route pointed at consistently — there were
// TWO PartsLabourLog.tsx files in the codebase, and the real route
// (dealer/inventory/parts-labour) loaded this one, not the other
// (deleted — it was wired to VehicleHistoryContext, a completely
// separate localStorage-only mock store with hardcoded fake MOT data,
// so it could never have shown a real vehicle either).
//
// Rebuilt as a genuinely per-vehicle recon view: real parts/labour
// costs (reusing the existing, already-correct AddCostModal/
// BookkeepingProvider rather than re-implementing a second, weaker
// cost form) plus quick links to real parts-finder sites.
//
// Only eBay's search genuinely takes the registration in the URL and
// pre-fills — Euro Car Parts and GSF Car Parts do their own reg
// lookup client-side with no URL parameter for it (checked live
// against the real sites rather than guessing), so those two just
// open the site for the dealer to type the reg in themselves. Labelled
// honestly rather than implying all three are pre-filled.
const PARTS_SITES: {
  name: string;
  url: (reg: string) => string;
  prefilled: boolean;
}[] = [
  {
    name: "eBay Motors",
    url: (reg) => `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(`${reg} car parts`)}`,
    prefilled: true,
  },
  {
    name: "Euro Car Parts",
    url: () => "https://www.eurocarparts.com/car-parts",
    prefilled: false,
  },
  {
    name: "GSF Car Parts",
    url: () => "https://www.gsfcarparts.com",
    prefilled: false,
  },
];

export default function PartsLabourLog() {
  const { vehicles } = useInventory();
  const { costs } = useBookkeeping();
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [showAddCost, setShowAddCost] = useState(false);

  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const reconCosts = vehicleId
    ? costs.filter((c) => c.vehicleId === vehicleId && (c.type === "parts" || c.type === "labour"))
    : [];
  const total = reconCosts.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="px-6 py-10 text-white animate-fadeIn">
      <SupernovaHeroHeader title="Parts & Labour Log" subtitle="Recon spend per vehicle, and quick links to find parts." />

      <SupernovaSectionDivider label="Vehicle" />
      <SupernovaGlowCard>
        <VehiclePicker value={vehicleId} onChange={setVehicleId} />
      </SupernovaGlowCard>

      {vehicle && (
        <>
          <SupernovaSectionDivider label="Find Parts" />
          <SupernovaGlowCard>
            <p className="text-white/60 text-sm mb-3">
              {vehicle.reg
                ? `Opens in a new tab. Reg: ${vehicle.reg}.`
                : "No registration on record for this vehicle — you'll need to enter it manually on the parts site."}
            </p>
            <div className="flex flex-wrap gap-3">
              {PARTS_SITES.map((site) => (
                <a
                  key={site.name}
                  href={site.url(vehicle.reg ?? "")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-yellow-500 text-black rounded font-semibold hover:bg-yellow-400"
                  title={site.prefilled ? "Registration pre-filled" : "Opens the site — enter the reg there"}
                >
                  {site.name}
                  {!site.prefilled && <span className="text-black/50 text-xs ml-1">↗</span>}
                </a>
              ))}
            </div>
          </SupernovaGlowCard>
        </>
      )}

      {vehicle && (
        <>
          <SupernovaSectionDivider label="Recon Costs" />
          <SupernovaGlowCard>
            <div className="flex justify-between items-center mb-4">
              <p className="text-white/70">Parts and labour logged against {vehicle.make} {vehicle.model}</p>
              <button
                onClick={() => setShowAddCost(true)}
                className="px-3 py-2 bg-green-500 text-black rounded hover:bg-green-400"
              >
                Add Cost
              </button>
            </div>

            {reconCosts.length === 0 ? (
              <p className="text-white/60">No parts or labour costs logged yet.</p>
            ) : (
              <div className="space-y-3">
                {reconCosts.map((c) => (
                  <div
                    key={c.id}
                    className="border border-white/10 rounded-lg p-3 bg-black/30 flex justify-between items-start"
                  >
                    <div>
                      <p className="text-white/80 font-semibold capitalize">
                        {c.type}
                        {c.supplier ? ` — ${c.supplier}` : ""}
                      </p>
                      {c.notes && <p className="text-white/50 text-sm">{c.notes}</p>}
                      <p className="text-white/60 text-xs">{c.date}</p>
                    </div>
                    <p className="text-yellow-400 font-bold">{formatMoney(c.amount, { pence: true })}</p>
                  </div>
                ))}
                <div className="flex justify-between pt-3 border-t border-white/10 font-bold text-white/80">
                  <span>Total</span>
                  <span>{formatMoney(total, { pence: true })}</span>
                </div>
              </div>
            )}
          </SupernovaGlowCard>
        </>
      )}

      {showAddCost && vehicleId && <AddCostModal vehicleId={vehicleId} onClose={() => setShowAddCost(false)} />}
    </div>
  );
}
