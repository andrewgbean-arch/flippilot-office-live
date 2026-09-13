import React, { useState } from "react";
import { useInventory } from "@/context/InventoryProvider";
import { fetchMOT } from "@/features/vehicles/api/mot";
import { SuperCard, SuperInput } from "@/features/vehicles/ui/SupernovaUI.web";

// Was searching VehicleHistoryContext — a store real vehicles are never
// written to (they live in InventoryProvider) — so this always said "No
// vehicle found" for any actual inventory vehicle, and its refreshMot()
// call didn't exist on that context's real API either.
export default function MotLookup() {
  const { vehicles, updateVehicleMOT } = useInventory();

  const [reg, setReg] = useState("");
  const [status, setStatus] = useState("");

  const lookup = async () => {
    const vehicle = vehicles.find((v) => v.mot?.reg?.toUpperCase() === reg.toUpperCase());
    if (!vehicle) {
      setStatus("No vehicle found with that reg.");
      return;
    }

    setStatus("Refreshing MOT…");

    const motData = await fetchMOT(reg);

    if (motData) {
      updateVehicleMOT(vehicle.id, {
        ...vehicle.mot,
        ...motData,
        expiry: motData.expiry ?? vehicle.mot?.expiry ?? "",
      });
      setStatus("MOT updated successfully!");
    } else {
      setStatus("MOT lookup failed.");
    }
  };

  return (
    <div className="min-h-screen bg-flipBlue p-10 text-white animate-fadeIn">
      <div className="mb-8 border-b border-gold pb-4">
        <h1 className="text-3xl font-extrabold text-gold">MOT Lookup</h1>
        <p className="text-white/60 text-sm">Refresh MOT data using a registration</p>
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
            className="w-full bg-gold text-black font-bold rounded-xl py-3 mt-2 shadow-goldGlow hover:bg-yellow-400 transition"
          >
            Refresh MOT
          </button>
        </SuperCard>

        {status && (
          <SuperCard title="Status">
            <p className="text-white">{status}</p>
          </SuperCard>
        )}
      </div>
    </div>
  );
}
