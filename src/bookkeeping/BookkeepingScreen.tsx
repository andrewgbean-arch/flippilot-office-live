import React, { useState } from "react";
import { Link } from "react-router-dom";
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
import { useAuth } from "@/context/AuthContext";
import { canWriteBookkeeping } from "@/lib/permissions";

export default function BookkeepingScreen() {
  const { getTotalSpend, getTotalProfit, sales, purchases } = useBookkeeping();
  const { user } = useAuth();
  const canWrite = canWriteBookkeeping(user);

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


  // Default pre-selection for the Cost/Sale modals (most recently
  // purchased vehicle) — just a starting point now, since both modals
  // have their own vehicle picker and can target any vehicle in stock.
  const selectedVehicleId = purchases.at(-1)?.vehicleId ?? null;

  return (
    <div className="min-h-screen bg-[#0A1128] text-white p-10 animate-fadeIn">

      {/* HEADER */}
      <SupernovaHeroHeader
        title="Bookkeeping Hub"
        subtitle="Track purchases, costs, sales, suppliers, and profit margins with Supernova intelligence."
      />

      {/* MAIN ACTION BUTTONS — recording purchases/costs/sales/
          transactions needs the Finance or Manager role (or owner);
          matches the real backend gate on PUT /bookkeeping, so a
          Sales/General account never gets as far as a confusing 403
          on submit. */}
      {canWrite ? (
        <div className="grid grid-cols-2 gap-6 my-10 max-w-3xl mx-auto">
          <GoldButton onPress={() => setShowPurchaseModal(true)}>
            Add Purchase
          </GoldButton>

          <GoldButton onPress={() => setShowCostModal(true)}>
            Add Cost
          </GoldButton>

          <GoldButton onPress={() => setShowSaleModal(true)}>
            Add Sale
          </GoldButton>

          <GoldButton onPress={() => setShowTransactionModal(true)}>
            Add Transaction
          </GoldButton>
        </div>
      ) : (
        <div className="my-10 max-w-3xl mx-auto text-center px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white/60 text-sm">
          Your account role ({user?.staffRole ?? "general"}) can view the books but not record
          purchases, costs, sales, or transactions — that needs the Finance or Manager role.
        </div>
      )}


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
        <div className="text-center">
          <Link
            to="/bookkeeping/suppliers"
            className="inline-block text-yellow-300 hover:text-yellow-200 font-semibold underline underline-offset-4"
          >
            View Full Purchase Source Analytics →
          </Link>
        </div>
      </div>

      {/* TRANSACTION MODAL BUTTON */}
      {showTransactionModal && (
  <AddTransactionModal
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
