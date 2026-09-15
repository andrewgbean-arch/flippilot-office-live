import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

import { useInventory } from "@/context/InventoryProvider";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";
import { SupernovaInput } from "@/components/supernova/SupernovaInput";

export default function ReconWorkflow() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { vehicles } = useInventory();
  const { costs, addCost } = useBookkeeping();

  const vehicle = vehicles.find((v) => v.id === id);

  const [newItem, setNewItem] = useState("");
  const [newCost, setNewCost] = useState("");

  if (!vehicle) {
    return (
      <div className="text-white p-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/70 hover:text-white transition mb-6"
        >
          <FiArrowLeft /> Back
        </button>
        <p>Vehicle not found.</p>
      </div>
    );
  }

  /* -------------------------------------------------------
     ⭐ Filter recon costs for this vehicle
  ------------------------------------------------------- */
  const reconItems = costs.filter((c) => c.vehicleId === vehicle.id);

  const totalRecon = useMemo(() => {
    return reconItems.reduce((sum, c) => sum + (c.amount ?? 0), 0);
  }, [reconItems]);

  /* -------------------------------------------------------
     ⭐ Add Recon Item
  ------------------------------------------------------- */
  const handleAddRecon = () => {
  if (!newItem.trim() || !newCost.trim()) return;

  const amount = Number(newCost);

  addCost({
    id: crypto.randomUUID(),
    vehicleId: vehicle.id,

    // ⭐ Recon cost type
    type: "recon",

    // ⭐ Recon item name
    label: newItem,

    // ⭐ Category grouping
    category: "Recon",

    // ⭐ Amount
    amount,

    // ⭐ VAT fields (recon usually has no VAT reclaim)
    vatRate: 0,
    vatIncluded: false,
    vatReclaimable: false,
    vatAmount: 0,
    netAmount: amount,

    // ⭐ Optional fields
    supplier: undefined,
    notes: undefined,

    // ⭐ Date
    date: new Date().toISOString(),
  });

  setNewItem("");
  setNewCost("");
};



  return (
    <div className="text-white bg-[#0A1128] min-h-screen p-10 animate-fadeIn">
      {/* ⭐ Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/70 hover:text-white transition mb-6"
      >
        <FiArrowLeft /> Back
      </button>

      <SupernovaHeroHeader
        title={`Recon Workflow: ${vehicle.make} ${vehicle.model}`}
        subtitle="Dealer AI • Vehicle Preparation & Costs"
      />

      <div className="max-w-5xl mx-auto space-y-10">
        {/* ⭐ Recon Summary */}
        <SupernovaSectionDivider label="Recon Summary" />

        <SupernovaGlowCard>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-white/60 text-sm">Total Recon Cost</p>
              <p className="text-yellow-300 font-bold text-xl">
                £{totalRecon.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Recon Items</p>
              <p className="text-white font-bold text-xl">
                {reconItems.length}
              </p>
            </div>

            <div>
              <p className="text-white/60 text-sm">AI Recon Estimate</p>
              <p className="text-white font-bold text-xl">
                £{Math.max(150, (vehicle.mileage ?? vehicle.mot?.mileage ?? 60000) / 10).toFixed(0)}
              </p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Status</p>
              <p className="text-green-400 font-bold text-xl">
                {reconItems.length > 0 ? "In Progress" : "Not Started"}
              </p>
            </div>
          </div>
        </SupernovaGlowCard>

        {/* ⭐ Add Recon Item */}
        <SupernovaSectionDivider label="Add Recon Item" />

        <SupernovaGlowCard>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SupernovaInput
              label="Recon Item"
              value={newItem}
              onChange={setNewItem}
              placeholder="Tyres, brakes, MOT prep..."
            />

            <SupernovaInput
              label="Cost (£)"
              value={newCost}
              onChange={setNewCost}
              placeholder="150"
            />

            <SupernovaGlowButton label="Add" onClick={handleAddRecon} />
          </div>
        </SupernovaGlowCard>

        {/* ⭐ Recon Items List */}
        <SupernovaSectionDivider label="Recon Items" />

        {reconItems.length === 0 ? (
          <p className="text-white/60 text-center text-lg">
            No recon items added yet.
          </p>
        ) : (
          reconItems.map((item) => (
            <SupernovaGlowCard key={item.id}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-white font-bold">{item.label}</p>
                  <p className="text-white/60 text-sm">
                    {new Date(item.date).toLocaleDateString()}
                  </p>
                </div>

                <p className="text-yellow-300 font-bold text-xl">
                  £{item.amount}
                </p>
              </div>
            </SupernovaGlowCard>
          ))
        )}
      </div>
    </div>
  );
}
