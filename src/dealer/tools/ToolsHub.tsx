import { useState } from "react";
import { Link } from "react-router-dom";
import { decodeVIN } from "../../engines/VinDecoder";
import { optimiseStock } from "../../engines/StockOptimizer";
import { useInventory } from "@/context/InventoryProvider";

import { SupernovaGlowCard } from "../../components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "../../components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "../../components/supernova/SupernovaSectionDivider";
import { SupernovaInput } from "../../components/supernova/SupernovaInput";
import { SupernovaGlowButton } from "../../components/supernova/SupernovaGlowButton";

const linkClass =
  "px-4 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-300 transition text-center";

export default function ToolsHub() {
  const { vehicles } = useInventory();

  // VIN Scanner state
  const [vin, setVin] = useState("");
  const [result, setResult] = useState<ReturnType<typeof decodeVIN> | null>(null);

  function handleScan() {
    setResult(decodeVIN(vin));
  }

  // Stock Optimiser — this used to run on a hardcoded 3-car fake array
  // (Fiesta/Corsa/Focus with made-up numbers) regardless of what was
  // actually in stock. Now it's the real inventory, using the real
  // createdAt timestamp set when a vehicle is added (older vehicles
  // added before that field existed are excluded rather than shown
  // with a fabricated age).
  const inStock = vehicles.filter((v) => v.status !== "sold");
  const trackedStock = inStock
    .filter((v) => v.createdAt)
    .map((v) => ({
      name: `${v.make} ${v.model}`,
      daysInStock: Math.floor(
        (Date.now() - new Date(v.createdAt!).getTime()) / 86400000
      ),
    }));
  const untrackedCount = inStock.length - trackedStock.length;
  const optimised = optimiseStock(trackedStock);

  return (
    <div className="min-h-screen bg-[#0A1128] text-white p-10 animate-fadeIn">

      {/* HEADER */}
      <SupernovaHeroHeader
        title="Tools Command Center"
        subtitle="FlipPilot Dealer OS"
      />

      {/* BADGE */}
      <div className="mb-10">
        <span className="inline-block px-4 py-2 bg-black/40 border border-yellow-400 rounded-lg text-yellow-300 text-sm">
          Shortcuts • Photos • Vehicles • Dealer Ops
        </span>
      </div>

      {/* GRID */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-10">

        {/* VEHICLE MANAGEMENT */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">Vehicle Management</h2>
          <div className="flex flex-col gap-3 text-white/70">
            <Link to="/new-flip" className={linkClass}>Add Vehicle</Link>
            <Link to="/dealer/inventory/list" className={linkClass}>Vehicle List</Link>
          </div>
        </SupernovaGlowCard>

        {/* VIN SCANNER */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">VIN Scanner</h2>
          <p className="text-white/50 text-xs mb-3">
            Decodes make and model year from the VIN itself. Model/trim/
            engine can't be reliably determined from a VIN alone — enter
            those manually when adding the vehicle. Best effort only: it
            recognises just five makes (Ford, Volkswagen, Mercedes, BMW and
            Toyota), and the year is read from a single character.
          </p>

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
              {result.error ? (
                <p className="text-red-400">{result.error}</p>
              ) : (
                <>
                  <p><strong>Make:</strong> {result.make}</p>
                  <p><strong>Model Year:</strong> {result.year ?? "Unknown"}</p>
                </>
              )}
            </div>
          )}
        </SupernovaGlowCard>

        {/* STOCK OPTIMISER */}
        <SupernovaGlowCard>
          <h2 className="text-red-400 font-bold text-xl mb-3">Stock Optimiser</h2>
          {trackedStock.length === 0 ? (
            <p className="text-white/60 text-sm">
              No stock-age data yet — this tracks how long each vehicle has
              been in inventory, starting from when it's added.
            </p>
          ) : (
            <p className="text-white/70">
              Slow movers (40+ days): {optimised.slow.length}
              <br />
              Fast movers (under 20 days): {optimised.fast.length}
            </p>
          )}
          {untrackedCount > 0 && (
            <p className="text-white/60 text-xs mt-2">
              {untrackedCount} vehicle{untrackedCount === 1 ? "" : "s"} added
              before stock-age tracking existed, excluded above.
            </p>
          )}
        </SupernovaGlowCard>

        {/* PHOTO STUDIO */}
        <SupernovaGlowCard>
          <h2 className="text-blue-400 font-bold text-xl mb-3">Photo Studio</h2>
          <p className="text-white/70 mb-4">
            See which cars still need photos, then open a car to add or
            remove its photos.
          </p>
          <Link to="/photo-studio" className={linkClass}>Open Photo Studio</Link>
        </SupernovaGlowCard>

        {/* MARKETPLACE TOOLS */}
        <SupernovaGlowCard>
          <h2 className="text-blue-400 font-bold text-xl mb-3">Marketplace Tools</h2>
          <p className="text-white/70 mb-4">
            A CSV stock feed you can give to a portal. Nothing is sent to any
            portal automatically.
          </p>
          <div className="flex flex-col gap-3">
            <Link to="/dealer/marketing/sync" className={linkClass}>Marketplace Sync</Link>
          </div>
        </SupernovaGlowCard>

        {/* DEALER OPERATIONS */}
        <SupernovaGlowCard>
          <h2 className="text-red-400 font-bold text-xl mb-3">Dealer Operations</h2>
          <p className="text-white/70 mb-4">
            Staff, finance, and risk tools.
          </p>
          <div className="flex flex-col gap-3">
            <Link to="/dealer/staff" className={linkClass}>Staff</Link>
            <Link to="/dealer/finance" className={linkClass}>Finance</Link>
            <Link to="/dealer/risk" className={linkClass}>Risk</Link>
          </div>
        </SupernovaGlowCard>

      </section>

      {/* COMING SOON — being upfront about what has no real feature
          behind it anywhere in the app yet, rather than a card that
          just describes something that doesn't exist */}
      <SupernovaSectionDivider label="Not Available Yet" />

      <SupernovaGlowCard>
        <h2 className="text-blue-400 font-bold text-xl mb-3">Coming Soon</h2>
        <ul className="space-y-3 text-white/70">
          <li>• Barcode / boot fair scanning tools</li>
          <li>• Dealer utilities (bulk exports, admin tools)</li>
          <li>• Auction bidding assistant</li>
          <li>• AI buying strategy generator</li>
          <li>• Vehicle photo AI enhancer / background remover</li>
        </ul>
      </SupernovaGlowCard>

    </div>
  );
}
