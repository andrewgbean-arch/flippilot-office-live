import React, { useState } from "react";
import { useInventory } from "@/context/InventoryProvider";
import { fetchMOT, type MOTData } from "@/features/vehicles/api/mot";
import { SuperCard, SuperInput } from "@/features/vehicles/ui/SupernovaUI.web";
import MotTestCard, { sortMotHistoryDesc } from "@/components/motors/MotTestCard";

// A genuine standalone reg lookup — not just a "refresh" for a vehicle
// already in stock. Real uses this needs to cover: checking a walk-in
// customer's trade-in before it's added anywhere, or verifying the reg
// a customer gave on an MOT booking (see publicBooking.ts) — neither of
// those is an existing inventory vehicle, so requiring a match before
// even calling the real DVSA/DVLA lookup (the previous behaviour) made
// this tool useless for anything but re-checking a car you already own.
export default function MotLookup() {
  const { vehicles, updateVehicleMOT } = useInventory();

  const [reg, setReg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MOTData | null>(null);
  const [updated, setUpdated] = useState(false);

  const matchedVehicle = vehicles.find(v => v.mot?.reg?.toUpperCase() === reg.trim().toUpperCase());

  async function lookup() {
    if (!reg.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setUpdated(false);

    const motData = await fetchMOT(reg.trim());
    setLoading(false);

    if (!motData) {
      setError("No MOT/vehicle data found for that registration.");
      return;
    }
    setResult({ ...motData, history: sortMotHistoryDesc(motData.history) });
  }

  function applyToVehicle() {
    if (!matchedVehicle || !result) return;
    updateVehicleMOT(matchedVehicle.id, {
      ...matchedVehicle.mot,
      ...result,
      expiry: result.expiry ?? matchedVehicle.mot?.expiry ?? "",
    });
    setUpdated(true);
  }

  return (
    <div className="min-h-screen bg-flipBlue p-10 text-white animate-fadeIn">
      <div className="mb-8 border-b border-gold pb-4">
        <h1 className="text-3xl font-extrabold text-gold">MOT Lookup</h1>
        <p className="text-white/60 text-sm">
          Look up real MOT history for any registration — a customer's own car, a potential trade-in, or a vehicle
          already in your stock.
        </p>
      </div>

      <div className="max-w-xl mx-auto space-y-6">
        <SuperCard title="Enter Registration">
          <SuperInput
            label="Registration"
            value={reg}
            onChange={(t) => setReg(t.toUpperCase())}
            placeholder="Enter reg"
          />

          <button
            onClick={lookup}
            disabled={loading || !reg.trim()}
            className="w-full bg-gold text-black font-bold rounded-xl py-3 mt-2 shadow-goldGlow hover:bg-yellow-400 transition disabled:opacity-50"
          >
            {loading ? "Looking up…" : "Look Up MOT"}
          </button>
        </SuperCard>

        {error && (
          <SuperCard title="Status">
            <p className="text-white">{error}</p>
          </SuperCard>
        )}

        {result && (
          <SuperCard title={`${result.make ?? "Unknown"} ${result.model ?? ""}`.trim()}>
            <div className="space-y-1 text-white/80 text-sm">
              <p>Colour: {result.colour ?? "Unknown"}</p>
              <p>Mileage: {result.mileage ? result.mileage.toLocaleString() : "Unknown"}</p>
              <p>MOT Expiry: {result.expiry ?? "Unknown"}</p>
              {result.advisories.length > 0 && <p>Advisories: {result.advisories.join("; ")}</p>}
            </div>

            {result.history.some(h => h.result === "FAIL") && (
              <div className="mt-4 border border-red-500/50 rounded-xl p-3 bg-red-950/20">
                <p className="text-red-300 text-xs uppercase tracking-wide font-bold mb-2">
                  Past MOT Failures — what this car has failed on before
                </p>
                <p className="text-white/50 text-xs mb-3">
                  Historical only — the car has since passed a later test. Not a current issue.
                </p>
                {result.history
                  .filter(h => h.result === "FAIL")
                  .map((h, i) => (
                    <MotTestCard key={i} h={h} />
                  ))}
              </div>
            )}

            {result.history.length > 0 && (
              <div className="mt-4 border border-white/10 rounded-xl p-3">
                <p className="text-white/60 text-xs uppercase tracking-wide font-bold mb-3">
                  Full Test History — most recent first
                </p>
                {result.history.map((h, i) => (
                  <MotTestCard key={i} h={h} />
                ))}
              </div>
            )}

            {matchedVehicle ? (
              <button
                onClick={applyToVehicle}
                className="w-full bg-gold text-black font-bold rounded-xl py-3 mt-4 shadow-goldGlow hover:bg-yellow-400 transition"
              >
                {updated ? "Updated!" : `Update ${matchedVehicle.make} ${matchedVehicle.model}'s MOT Record`}
              </button>
            ) : (
              <p className="text-white/50 text-xs mt-4">
                Not a vehicle in your current stock — this is a read-only lookup.
              </p>
            )}
          </SuperCard>
        )}
      </div>
    </div>
  );
}
