import { Link } from "react-router-dom";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

import { useInventory } from "@/context/InventoryProvider";

// "Overall Photo Quality / Lighting Score / Background Cleanliness" used
// to be hardcoded to 78/65/82 regardless of any vehicle's actual photos
// — there's no real image-analysis engine anywhere in this app to back
// numbers like that, so showing them as if computed was pure fiction.
// "Vehicles Missing Photos" also printed "No photo metadata available"
// for every single vehicle, whether it had photos or not. Replaced both
// with what's actually knowable: real photo counts per vehicle, and a
// genuine missing/has-photos split. Photo upload itself already exists
// for real on each vehicle's Edit tab (EditVehicle.tsx) — linked out to
// that rather than duplicating an upload UI here.
export default function PhotosWorkflow() {
  const { vehicles } = useInventory();

  const withPhotos = vehicles.filter((v) => (v.images?.length ?? 0) > 0);
  const missingPhotos = vehicles.filter((v) => (v.images?.length ?? 0) === 0);
  const totalPhotos = vehicles.reduce((sum, v) => sum + (v.images?.length ?? 0), 0);
  const avgPhotos = vehicles.length > 0 ? (totalPhotos / vehicles.length).toFixed(1) : "0";

  return (
    <div className="px-6 py-10 space-y-10">
      <SupernovaHeroHeader
        title="Photos Workflow"
        subtitle="Track photo coverage across your stock."
      />

      <SupernovaSectionDivider label="Portfolio Photo Coverage" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white/70">
        <SupernovaGlowCard>
          <p className="text-white/60 text-sm">Vehicles With Photos</p>
          <p className="text-yellow-300 font-bold text-2xl mt-1">
            {withPhotos.length}/{vehicles.length}
          </p>
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <p className="text-white/60 text-sm">Total Photos</p>
          <p className="text-yellow-300 font-bold text-2xl mt-1">{totalPhotos}</p>
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <p className="text-white/60 text-sm">Avg Photos per Vehicle</p>
          <p className="text-yellow-300 font-bold text-2xl mt-1">{avgPhotos}</p>
        </SupernovaGlowCard>
      </div>

      <SupernovaSectionDivider label="Vehicles Missing Photos" />

      <SupernovaGlowCard>
        {vehicles.length === 0 ? (
          <p className="text-white/60">Add vehicles to your inventory to track photo coverage.</p>
        ) : missingPhotos.length === 0 ? (
          <p className="text-white/60">Every vehicle has at least one photo.</p>
        ) : (
          <div className="space-y-4">
            {missingPhotos.map((v) => (
              <Link
                key={v.id}
                to={`/dealer/inventory/${v.id}`}
                className="block p-4 bg-black/40 border border-white/10 rounded-lg hover:bg-black/60 transition"
              >
                <div className="text-white font-semibold">
                  {v.make} {v.model}
                </div>
                <div className="text-white/60 text-xs">
                  No photos yet — click to add some from its Edit tab.
                </div>
              </Link>
            ))}
          </div>
        )}
      </SupernovaGlowCard>
    </div>
  );
}
