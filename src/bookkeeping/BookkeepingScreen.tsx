import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
import { formatMoney } from "@/lib/formatMoney";
import { hubTotals, leftOutNote } from "./profitTotals";

function SummaryTile({
  label,
  value,
  note,
  border,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  border: string;
  tone: string;
}) {
  return (
    <div className={`bg-black/40 border ${border} p-4 sm:p-6 rounded-xl shadow-lg`}>
      <p className="text-white/70 text-sm">{label}</p>
      <p className={`mt-1 text-xl sm:text-2xl font-bold ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-white/60">{note}</p>
    </div>
  );
}

export default function BookkeepingScreen() {
  const { costs, sales, purchases } = useBookkeeping();
  const { user } = useAuth();
  const canWrite = canWriteBookkeeping(user);

  // Profit and margin are worked out on SOLD cars only (see profitTotals.ts).
  // The hub used to subtract every purchase from sales income, so stock still
  // on the forecourt showed up as a loss.
  const totals = hubTotals(purchases, sales, costs);

  // MODAL STATE
// MODAL STATE. The /bookkeeping/add-* addresses (the dashboard's buttons,
// the Getting started card) arrive with state.openForm so the right form is
// already open, instead of landing on the hub and needing a second click.
// Only for roles that can record; others see the hub's explanation instead.
const location = useLocation();
const openForm = canWrite ? (location.state as { openForm?: string } | null)?.openForm : undefined;
const [showPurchaseModal, setShowPurchaseModal] = useState(openForm === "purchase");
const [showCostModal, setShowCostModal] = useState(openForm === "cost");
const [showSaleModal, setShowSaleModal] = useState(openForm === "sale");
const [showTransactionModal, setShowTransactionModal] = useState(openForm === "transaction");


  // Default pre-selection for the Cost/Sale modals (most recently
  // purchased vehicle) — just a starting point now, since both modals
  // have their own vehicle picker and can target any vehicle in stock.
  const selectedVehicleId = purchases.at(-1)?.vehicleId ?? null;

  return (
    <div className="text-white animate-fadeIn">

      {/* HEADER */}
      <div data-tour="tour-bookkeeping">
        <SupernovaHeroHeader
          title="Bookkeeping Hub"
          subtitle="Track purchases, costs, sales, suppliers and profit."
        />
      </div>

      {/* MAIN ACTION BUTTONS — recording purchases/costs/sales/
          transactions needs the Finance or Manager role (or owner);
          matches the real backend gate on PUT /bookkeeping, so a
          Sales/General account never gets as far as a confusing 403
          on submit. */}
      {canWrite ? (
        <div data-tour="tour-bookkeeping-actions" className="grid grid-cols-2 gap-3 sm:gap-6 my-6 max-w-3xl mx-auto">
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
        <SummaryTile
          label="Total spent"
          value={formatMoney(totals.spend)}
          note="Purchases and costs, sold or not"
          border="border-yellow-400/20"
          tone="text-yellow-300"
        />
        <SummaryTile
          label="Profit on sold cars"
          value={formatMoney(totals.profit)}
          note={leftOutNote(totals) ?? `${totals.soldCounted} car${totals.soldCounted === 1 ? "" : "s"} sold`}
          border="border-green-400/20"
          tone={totals.profit < 0 ? "text-red-300" : "text-green-300"}
        />
        <SummaryTile
          label="Margin on sold cars"
          value={totals.marginPercent === null ? "—" : `${totals.marginPercent.toFixed(1)}%`}
          note="Profit as a share of sale price"
          border="border-blue-400/20"
          tone="text-blue-300"
        />
        <SummaryTile
          label="Bought, not yet sold"
          value={String(totals.boughtNotSold)}
          note="Cars still to sell"
          border="border-purple-400/20"
          tone="text-purple-300"
        />
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
