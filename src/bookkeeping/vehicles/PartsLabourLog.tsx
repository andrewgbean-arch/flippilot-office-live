import React, { useState } from "react";
import { useParams } from "react-router-dom";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaInput } from "@/components/supernova/SupernovaInput";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";

export default function PartsLabourLog() {
  const { id } = useParams();
  const vehicleId = id as string;

  const { vehicles } = useVehicleHistory();
  const { costs, addCost } = useBookkeeping();

  const vehicle = vehicles.find((v) => v.id === vehicleId);

  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");

  if (!vehicle) {
    return (
      <div className="p-10 text-white">
        <h1 className="text-2xl font-bold text-red-400">Vehicle Not Found</h1>
        <p className="text-white/60 mt-2">
          This vehicle does not exist in your inventory records.
        </p>
      </div>
    );
  }

  const handleAddCost = () => {
    if (!notes.trim() || !amount.trim()) return;

    const amt = Number(amount);

    addCost({
      id: crypto.randomUUID(),
      vehicleId,

      // ⭐ REQUIRED FIELDS FOR CostEntry
      type: "parts",            // or "labour" — you can add a toggle later
      amount: amt,
      vatRate: 0,
      vatIncluded: false,
      vatReclaimable: false,
      vatAmount: 0,
      netAmount: amt,

      notes,
      date: new Date().toISOString().slice(0, 10),
    });

    setNotes("");
    setAmount("");
  };

  const vehicleCosts = costs.filter((c) => c.vehicleId === vehicleId);

  return (
    <div className="p-6 text-white animate-fadeIn">

      <SupernovaHeroHeader
        title="Parts & Labour Log"
        subtitle={vehicle.title ?? "Vehicle Record"}
      />

      <SupernovaSectionDivider label="Add New Entry" />

      <SupernovaGlowCard>
        <SupernovaInput
          label="Description"
          value={notes}
          onChange={setNotes}
          placeholder="Brake pads, oil change, diagnostics..."
        />

        <SupernovaInput
          label="Cost (£)"
          value={amount}
          onChange={setAmount}
          placeholder="50"
        />

        <div className="mt-4">
          <SupernovaGlowButton label="Add Entry" onClick={handleAddCost} />
        </div>
      </SupernovaGlowCard>

      <SupernovaSectionDivider label="Existing Entries" />

      <SupernovaGlowCard>
        {vehicleCosts.length > 0 ? (
          <div className="space-y-4">
            {vehicleCosts.map((c) => (
              <div
                key={c.id}
                className="border border-white/20 rounded-xl p-4 bg-black/20"
              >
                <p className="text-white/80">{c.notes}</p>
                <p className="text-yellow-400 font-bold">£{c.amount}</p>
                <p className="text-white/40 text-sm">{c.date}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/60">No parts or labour recorded yet.</p>
        )}
      </SupernovaGlowCard>
    </div>
  );
}
