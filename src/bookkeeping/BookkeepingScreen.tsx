import React, { useState } from "react";
import { useBookkeeping } from "./BookkeepingProvider";

import BookkeepingTable from "./BookkeepingTable";
import SupplierPerformance from "./SupplierPerformance";
import CostBreakdown from "./CostBreakdown";

import AddPurchaseModal from "./AddPurchaseModal";
import AddCostModal from "./AddCostModal";
import AddSaleModal from "./AddSaleModal";
import AddTransactionModal from "./AddTransactionModal";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import GoldButton from "@/components/ui/GoldButton.web";   // ⭐ FIXED

export default function BookkeepingScreen() {
  const { getTotalSpend, getTotalProfit, sales, purchases } = useBookkeeping();

  const totalSpend = getTotalSpend();
  const totalProfit = getTotalProfit();
  const activeFlips = sales.length;

  const avgMargin =
    activeFlips > 0 ? (totalProfit / (totalSpend || 1)) * 100 : 0;

  // MODAL STATE
// MODAL STATE
const [showPurchaseModal, setShowPurchaseModal] = useState(false);
const [showCostModal, setShowCostModal] = useState(false);
const [showSaleModal, setShowSaleModal] = useState(false);
const [showTransactionModal, setShowTransactionModal] = useState(false); // ⭐ FIXED


  // AUTO-SELECT MOST RECENT VEHICLE
  const selectedVehicleId =
    purchases.length > 0 ? purchases[purchases.length - 1].vehicleId : null;

  // SMART BUTTON LOGIC
  function handleAddCost() {
    if (!selectedVehicleId) {
      setShowPurchaseModal(true);
      return;
    }
    setShowCostModal(true);
  }

  function handleAddSale() {
    if (!selectedVehicleId) {
      setShowPurchaseModal(true);
      return;
    }
    setShowSaleModal(true);
  }

  return (
    <div className="min-h-screen bg-[#0A1128] text-white p-10 animate-fadeIn">

      {/* HEADER */}
      <SupernovaHeroHeader
        title="Bookkeeping Hub"
        subtitle="Track purchases, costs, sales, suppliers, and profit margins with Supernova intelligence."
      />

      {/* MAIN ACTION BUTTONS */}
<div className="grid grid-cols-2 gap-6 my-10 max-w-3xl mx-auto">
  <GoldButton onPress={() => setShowPurchaseModal(true)}>
    Add Purchase
  </GoldButton>

  <GoldButton onPress={handleAddCost}>
    Add Cost
  </GoldButton>

  <GoldButton onPress={handleAddSale}>
    Add Sale
  </GoldButton>

  <GoldButton onPress={() => setShowTransactionModal(true)}>
    Add Transaction
  </GoldButton>
</div>


      {/* SUMMARY CARDS */}
      <SupernovaSectionDivider label="Summary" />

      <div className="grid grid-cols-4 gap-6 mb-10">
        <div className="bg-black/40 border border-yellow-400/20 p-6 rounded-xl shadow-lg">
          <p className="text-white/60 text-sm">Total Spend</p>
          <h2 className="text-2xl font-bold text-yellow-300">
            £{totalSpend.toFixed(2)}
          </h2>
        </div>

        <div className="bg-black/40 border border-green-400/20 p-6 rounded-xl shadow-lg">
          <p className="text-white/60 text-sm">Total Profit</p>
          <h2 className="text-2xl font-bold text-green-300">
            £{totalProfit.toFixed(2)}
          </h2>
        </div>

        <div className="bg-black/40 border border-blue-400/20 p-6 rounded-xl shadow-lg">
          <p className="text-white/60 text-sm">Avg Margin</p>
          <h2 className="text-2xl font-bold text-blue-300">
            {avgMargin.toFixed(1)}%
          </h2>
        </div>

        <div className="bg-black/40 border border-purple-400/20 p-6 rounded-xl shadow-lg">
          <p className="text-white/60 text-sm">Active Flips</p>
          <h2 className="text-2xl font-bold text-purple-300">
            {activeFlips}
          </h2>
        </div>
      </div>

      {/* LEDGER TABLE */}
      <SupernovaSectionDivider label="Ledger" />
      <BookkeepingTable />

      {/* ANALYTICS */}
      <SupernovaSectionDivider label="Analytics" />

      <div className="space-y-10 max-w-4xl mx-auto">
        <CostBreakdown />
        <SupplierPerformance />
      </div>

      {/* TRANSACTION MODAL BUTTON */}
      {showTransactionModal && (
  <AddTransactionModal
    vehicleId={selectedVehicleId}
    onClose={() => setShowTransactionModal(false)}
  />
)}


      {/* MODALS */}
      {showPurchaseModal && (
        <AddPurchaseModal
          vehicleId={selectedVehicleId}
          onClose={() => setShowPurchaseModal(false)}
        />
      )}

      {showCostModal && (
        <AddCostModal
          vehicleId={selectedVehicleId}
          onClose={() => setShowCostModal(false)}
        />
      )}

      {showSaleModal && (
        <AddSaleModal
          vehicleId={selectedVehicleId}
          onClose={() => setShowSaleModal(false)}
        />
      )}
    </div>
  );
}
