import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBookkeeping } from "./BookkeepingProvider";
import { useInventory } from "@/context/InventoryProvider";
import AddCostModal from "./AddCostModal";
import AddSaleModal from "./AddSaleModal";

export default function BookkeepingEntryScreen() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const {
    purchases,
    costs,
    sales,
    getTotalCostForVehicle,
    getProfitForVehicle,
  } = useBookkeeping();
  const { vehicles } = useInventory();

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const vehicleLabel = vehicle ? `${vehicle.make} ${vehicle.model}` : vehicleId;

  const purchase = purchases.find((p) => p.vehicleId === vehicleId);
  const vehicleCosts = costs.filter((c) => c.vehicleId === vehicleId);
  const sale = sales.find((s) => s.vehicleId === vehicleId);

  const totalCost = getTotalCostForVehicle(vehicleId!);

  const profitSummary = getProfitForVehicle(vehicleId!) ?? { profit: 0, margin: 0 };

  const [showCostModal, setShowCostModal] = React.useState(false);
  const [showSaleModal, setShowSaleModal] = React.useState(false);

  if (!purchase) {
    return (
      <div className="p-10 text-white">
        <h2 className="text-2xl font-bold text-red-400">Vehicle Not Found</h2>
        <p className="text-white/60 mt-2">
          This vehicle does not exist in your bookkeeping records.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn text-white">

      {/* MODALS */}
      {showCostModal && (
        <AddCostModal
          vehicleId={vehicleId!}
          onClose={() => setShowCostModal(false)}
        />
      )}

      {showSaleModal && (
        <AddSaleModal
          vehicleId={vehicleId!}
          {...(sale ? { existing: sale } : {})}
          onClose={() => setShowSaleModal(false)}
        />
      )}

      {/* HEADER */}
      <h1 className="text-3xl font-bold text-yellow-300 mb-6 drop-shadow-[0_0_12px_rgba(255,215,0,0.5)]">
        Vehicle Ledger — {vehicleLabel}
      </h1>

      {/* PURCHASE CARD */}
      <div className="bg-black/40 border border-white/10 p-6 rounded-xl mb-8">
        <h2 className="text-xl font-semibold text-white/80 mb-3">Purchase</h2>

        <p><span className="text-white/60">Price:</span> £{purchase.purchasePrice.toLocaleString()}</p>
        <p><span className="text-white/60">Purchased From:</span> {purchase.source}</p>
        <p><span className="text-white/60">Date:</span> {purchase.date}</p>
        <p><span className="text-white/60">VAT:</span> £{purchase.vatAmount.toLocaleString()}</p>
        <p><span className="text-white/60">Net:</span> £{purchase.netAmount.toLocaleString()}</p>
      </div>

      {/* COSTS */}
      <div className="bg-black/40 border border-white/10 p-6 rounded-xl mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-semibold text-white/80">Costs</h2>
          <button
            onClick={() => setShowCostModal(true)}
            className="px-3 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-400"
          >
            Add Cost
          </button>
        </div>

        {vehicleCosts.length === 0 ? (
          <p className="text-white/60">No costs added yet.</p>
        ) : (
          <ul className="space-y-2">
            {vehicleCosts.map((c) => (
              <li
                key={c.id}
                className="border border-white/10 p-3 rounded bg-black/30"
              >
                <p className="text-white/80 font-semibold">{c.type}</p>
                <p className="text-white/60">Supplier: {c.supplier}</p>
                <p className="text-white/60">Date: {c.date}</p>
                <p className="text-white/60">
                  Amount: £{c.amount.toLocaleString()}
                </p>
                <p className="text-white/60">
                  VAT: £{c.vatAmount.toLocaleString()}
                </p>
                <p className="text-white/60">
                  Net: £{c.netAmount.toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-white/80 font-bold">
          Total Cost: £{totalCost.toLocaleString()}
        </p>
      </div>

      {/* SALE */}
      <div className="bg-black/40 border border-white/10 p-6 rounded-xl mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-semibold text-white/80">Sale</h2>

          {!sale && (
            <button
              onClick={() => setShowSaleModal(true)}
              className="px-3 py-2 bg-green-500 text-black rounded hover:bg-green-400"
            >
              Record Sale
            </button>
          )}
        </div>

        {sale ? (
          <>
            <p><span className="text-white/60">Invoice No:</span> {sale.invoiceNumber}</p>
            <p><span className="text-white/60">Sale Price:</span> £{sale.salePrice.toLocaleString()}</p>
            <p><span className="text-white/60">Buyer:</span> {sale.buyer || "—"}</p>
            {sale.buyerEmail && <p><span className="text-white/60">Email:</span> {sale.buyerEmail}</p>}
            {sale.buyerPhone && <p><span className="text-white/60">Phone:</span> {sale.buyerPhone}</p>}
            <p><span className="text-white/60">Date:</span> {sale.date}</p>
            <p><span className="text-white/60">VAT:</span> £{sale.vatAmount.toLocaleString()}</p>
            <p><span className="text-white/60">Net:</span> £{sale.netAmount.toLocaleString()}</p>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => navigate(`/bookkeeping/invoice/${vehicleId}`)}
                className="px-3 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-400"
              >
                View / Print Invoice
              </button>
              <button
                onClick={() => setShowSaleModal(true)}
                className="px-3 py-2 bg-white/10 text-white/70 rounded hover:bg-white/20"
              >
                Edit Sale
              </button>
            </div>
          </>
        ) : (
          <p className="text-white/60">No sale recorded yet.</p>
        )}
      </div>

      {/* PROFIT */}
      <div className="bg-black/40 border border-white/10 p-6 rounded-xl mb-8">
        <h2 className="text-xl font-semibold text-white/80 mb-3">Profit Summary</h2>

        <p><span className="text-white/60">Profit:</span> £{profitSummary.profit.toLocaleString()}</p>
        <p><span className="text-white/60">Margin:</span> {profitSummary.margin.toFixed(1)}%</p>
      </div>

      {/* TIMELINE */}
      <div className="bg-black/40 border border-white/10 p-6 rounded-xl mb-8">
        <h2 className="text-xl font-semibold text-white/80 mb-3">Timeline</h2>

        <ul className="space-y-2">
          <li className="p-3 bg-black/30 border border-white/10 rounded">
            Purchased — {purchase.date}
          </li>

          {vehicleCosts.map((c) => (
            <li
              key={c.id}
              className="p-3 bg-black/30 border border-white/10 rounded"
            >
              Cost Added — {c.type} — {c.date}
            </li>
          ))}

          {sale && (
            <li className="p-3 bg-black/30 border border-white/10 rounded">
              Sold — {sale.date}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
