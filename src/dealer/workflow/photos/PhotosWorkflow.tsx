import { Link } from "react-router-dom";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

import { useInventory } from "@/context/InventoryProvider";
import { unsold } from "@/dealer/inventory/stockFacts";
import { SHOT_LIST } from "@/photoStudio/photoEdits";

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

  // Cars still for sale only: sold cars don't need photos any more, and
  // counting them made coverage look far worse than it is.
  const forSale = unsold(vehicles);
  const withPhotos = forSale.filter((v) => (v.images?.length ?? 0) > 0);
  const totalPhotos = forSale.reduce((sum, v) => sum + (v.images?.length ?? 0), 0);
  const avgPhotos = forSale.length > 0 ? (totalPhotos / forSale.length).toFixed(1) : "0";
  // The ones needing photos most first.
  const byNeed = [...forSale].sort((a, b) => (a.images?.length ?? 0) - (b.images?.length ?? 0));

  return (
    <div className="px-6 py-10 space-y-10">
      <SupernovaHeroHeader
        title="Photo Studio"
        subtitle="Photo coverage across your stock, and the cars still waiting for photos."
      />

      <SupernovaSectionDivider label="Photos on your stock" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white/70">
        <SupernovaGlowCard>
          <p className="text-white/60 text-sm">Cars in stock with photos</p>
          <p className="text-yellow-300 font-bold text-2xl mt-1">
            {withPhotos.length}/{forSale.length}
          </p>
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <p className="text-white/60 text-sm">Photos on cars in stock</p>
          <p className="text-yellow-300 font-bold text-2xl mt-1">{totalPhotos}</p>
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <p className="text-white/60 text-sm">Average per car</p>
          <p className="text-yellow-300 font-bold text-2xl mt-1">{avgPhotos}</p>
        </SupernovaGlowCard>
      </div>

      <SupernovaSectionDivider label="Your stock · open a car to edit its photos" />

      {forSale.length === 0 ? (
        <SupernovaGlowCard>
          <p className="text-white/60">Add vehicles to your stock and their photos appear here.</p>
        </SupernovaGlowCard>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {byNeed.map((v) => {
            const count = v.images?.length ?? 0;
            const main = v.images?.[0];
            return (
              <Link
                key={v.id}
                to={`/photo-studio/${v.id}`}
                className="group block rounded-xl overflow-hidden border border-white/10 bg-black/40 hover:border-yellow-400/70 hover:shadow-[0_0_16px_rgba(255,215,0,0.35)] transition"
              >
                <div className="relative h-32 bg-black/60">
                  {main ? (
                    <img src={main} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-white/40 text-sm">No photos yet</div>
                  )}
                  <span className={`absolute right-2 top-2 rounded-md px-2 py-0.5 text-xs font-bold ${count === 0 ? "bg-orange-500 text-white" : count < SHOT_LIST.length ? "bg-black/70 text-yellow-300" : "bg-green-600 text-white"}`}>
                    {count} {count === 1 ? "photo" : "photos"}
                  </span>
                </div>
                <div className="p-3">
                  <div className="text-white font-semibold truncate">{[v.year, v.make, v.model].filter(Boolean).join(" ")}</div>
                  <div className="text-xs text-yellow-300/80 group-hover:text-yellow-300">Open in Photo Studio →</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
