import { formatMoney } from "@/lib/formatMoney";
import { isPositiveAmount } from "@/lib/parseMoney";
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBookkeeping } from "./BookkeepingProvider";
import { useLedgerPurchases } from "./useLedgerPurchases";
import { isMarginPurchase } from "./purchaseVat";
import { useInventory } from "@/context/InventoryProvider";
import AddCostModal from "./AddCostModal";
import AddSaleModal from "./AddSaleModal";
import RecordPurchasePriceModal from "./RecordPurchasePriceModal";
import VoidSaleModal from "./VoidSaleModal";
import { salePricePaid, trustedSaleVat } from "./saleVat";

// Ask before removing a record that changes a car's profit. With no browser to ask
// in (a test, a server render) there is nobody to ask, so it goes ahead.
function confirmDelete(message: string): boolean {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return true;
  return window.confirm(message);
}

export default function BookkeepingEntryScreen() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const {
    costs,
    sales,
    allSales,
    getTotalCostForVehicle,
    getProfitForVehicle,
    deleteCost,
  } = useBookkeeping();
  const { vehicles } = useInventory();
  // Margin-scheme purchases saved with phantom VAT read as the no-VAT purchases
  // they are (in memory only; nothing stored is rewritten).
  const purchases = useLedgerPurchases();

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const vehicleLabel = vehicle ? `${vehicle.make} ${vehicle.model}` : vehicleId;

  const purchase = purchases.find((p) => p.vehicleId === vehicleId);
  const vehicleCosts = costs.filter((c) => c.vehicleId === vehicleId);
  const sale = sales.find((s) => s.vehicleId === vehicleId);
  // This car's voided sales, kept for the record (saleStatus.ts).
  const voidedSales = allSales.filter((s) => s.vehicleId === vehicleId && s.voided);

  const totalCost = getTotalCostForVehicle(vehicleId!);
  // The sale's VAT and net, only as far as they can be trusted (see saleVat.ts).
  const saleVat = sale ? trustedSaleVat(sale) : { vat: null, net: null };
  // What the customer paid: with VAT added on top, the stored price is before VAT.
  const paid = sale ? salePricePaid(sale, saleVat.vat) : null;

  // null = not worked out (no sale yet, or no purchase price recorded). It must
  // not be shown as £0 profit and 0.0% margin, which reads as a car that broke even.
  const profitSummary = getProfitForVehicle(vehicleId!);

  const [showCostModal, setShowCostModal] = React.useState(false);
  const [showSaleModal, setShowSaleModal] = React.useState(false);
  const [showPurchasePriceModal, setShowPurchasePriceModal] = React.useState(false);
  const [showEditPurchaseModal, setShowEditPurchaseModal] = React.useState(false);
  const [showVoidSaleModal, setShowVoidSaleModal] = React.useState(false);

  // A car with no purchase in the books (a sold car imported from a spreadsheet,
  // say) still has a ledger: it shows "No purchase recorded" and a way to add one.
  // Only a car that exists nowhere is "not found".
  if (!purchase && !vehicle && !sale && voidedSales.length === 0) {
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

      {showPurchasePriceModal && (
        <RecordPurchasePriceModal
          vehicleId={vehicleId!}
          scheme={vehicle?.vatScheme === "standard" ? "standard" : "margin"}
          vehicleLabel={vehicleLabel ?? ""}
          hasPurchase={purchase !== undefined}
          onClose={() => setShowPurchasePriceModal(false)}
        />
      )}

      {showEditPurchaseModal && purchase && (
        <RecordPurchasePriceModal
          vehicleId={vehicleId!}
          scheme={(vehicle?.vatScheme ?? purchase.vatScheme) === "standard" ? "standard" : "margin"}
          vehicleLabel={vehicleLabel ?? ""}
          existing={purchase}
          onClose={() => setShowEditPurchaseModal(false)}
        />
      )}

      {showVoidSaleModal && sale && (
        <VoidSaleModal sale={sale} vehicleLabel={vehicleLabel ?? ""} onClose={() => setShowVoidSaleModal(false)} />
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

        {!purchase ? (
          <>
            <p className="text-yellow-200/90">No purchase recorded for this car, so its profit can't be worked out.</p>
            <button
              onClick={() => setShowPurchasePriceModal(true)}
              className="mt-3 px-3 py-2 bg-blue-500 text-black rounded hover:bg-blue-400"
            >
              Record what you paid
            </button>
          </>
        ) : (
        <>
        <p>
          <span className="text-white/60">Price:</span>{" "}
          {isPositiveAmount(purchase.purchasePrice) ? formatMoney(purchase.purchasePrice) : "Not recorded"}
        </p>
        {!isPositiveAmount(purchase.purchasePrice) && (
          <button
            onClick={() => setShowPurchasePriceModal(true)}
            className="mt-2 mb-2 px-3 py-2 bg-blue-500 text-black rounded hover:bg-blue-400"
          >
            Record purchase price
          </button>
        )}
        {isPositiveAmount(purchase.purchasePrice) && (
          <button
            onClick={() => setShowEditPurchaseModal(true)}
            className="mt-1 mb-2 px-3 py-1 text-sm rounded bg-white/10 text-white/70 hover:bg-white/20"
          >
            Edit purchase
          </button>
        )}
        <p><span className="text-white/60">Purchased From:</span> {purchase.source}</p>
        <p><span className="text-white/60">Date:</span> {purchase.date}</p>
        {isMarginPurchase(purchase) ? (
          // Bought under the Margin Scheme: there is no VAT invoice on the purchase,
          // so no VAT amount is shown (there is none to reclaim).
          <p><span className="text-white/60">VAT:</span> None: bought under the Margin Scheme</p>
        ) : (
          <>
            <p><span className="text-white/60">VAT:</span> {formatMoney(purchase.vatAmount, { pence: true })}</p>
            <p><span className="text-white/60">Net:</span> {formatMoney(purchase.netAmount, { pence: true })}</p>
          </>
        )}
        </>
        )}
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
                  Amount: {formatMoney(c.amount)}
                </p>
                <p className="text-white/60">
                  VAT: {formatMoney(c.vatAmount, { pence: true })}
                </p>
                <p className="text-white/60">
                  Net: {formatMoney(c.netAmount, { pence: true })}
                </p>
                {c.consumableId ? (
                  // A cost raised against real stock has its parts to give back: that is
                  // done from the Recon screen, which returns the stock with the cost.
                  <p className="text-white/50 text-xs mt-2">Raised against stock: remove it from the Recon screen.</p>
                ) : (
                  <button
                    onClick={() => {
                      if (confirmDelete(`Delete this ${c.type} cost of ${formatMoney(c.amount, { pence: true })}? The car's profit will change.`)) {
                        deleteCost(c.id);
                      }
                    }}
                    className="mt-2 px-2 py-1 text-xs rounded bg-white/10 text-white/70 hover:bg-red-500/30"
                  >
                    Delete cost
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-white/80 font-bold">
          Total Cost: {formatMoney(totalCost)}
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
            <p>
              <span className="text-white/60">Sale Price:</span>{" "}
              {paid?.paid != null
                ? formatMoney(paid.paid)
                : paid?.vatOnTop && paid.beforeVat != null
                  ? `${formatMoney(paid.beforeVat)} before VAT`
                  : "Not recorded"}
            </p>
            {paid?.vatOnTop && paid.paid != null && paid.beforeVat != null && (
              <p className="text-white/60 text-sm">
                {formatMoney(paid.beforeVat)} plus {formatMoney(saleVat.vat, { pence: true })} VAT added on top
              </p>
            )}
            <p><span className="text-white/60">Buyer:</span> {sale.buyer || "—"}</p>
            {sale.buyerEmail && <p><span className="text-white/60">Email:</span> {sale.buyerEmail}</p>}
            {sale.buyerPhone && <p><span className="text-white/60">Phone:</span> {sale.buyerPhone}</p>}
            <p><span className="text-white/60">Date:</span> {sale.date}</p>
            <p><span className="text-white/60">VAT:</span> {formatMoney(saleVat.vat, { pence: true })}</p>
            <p><span className="text-white/60">Net:</span> {formatMoney(saleVat.net, { pence: true })}</p>
            {saleVat.vat === null && sale.vatScheme === "margin" && (
              <p className="text-orange-300/90 text-sm mt-1">
                The VAT due on this Margin Scheme sale is not worked out: it needs a recorded purchase price.
              </p>
            )}

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
              <button
                onClick={() => setShowVoidSaleModal(true)}
                className="px-3 py-2 rounded border border-red-400/50 text-red-300 hover:bg-red-500/10"
              >
                Void sale
              </button>
            </div>
          </>
        ) : (
          <p className="text-white/60">No sale recorded yet.</p>
        )}

        {voidedSales.length > 0 && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="text-white/70 font-semibold mb-2">Voided sales</h3>
            <ul className="space-y-2">
              {voidedSales.map((v) => (
                <li key={v.id} className="p-3 rounded bg-black/30 border border-red-400/20 text-sm">
                  <p className="text-white/80">
                    <span className="text-red-300 font-semibold">VOID</span> · Invoice {v.invoiceNumber} ·{" "}
                    {isPositiveAmount(v.salePrice) ? formatMoney(v.salePrice) : "no price"} · sold {v.date}
                  </p>
                  <p className="text-white/60">
                    Voided {v.voided!.at.slice(0, 10)} by {v.voided!.byName}: {v.voided!.reason}
                  </p>
                  <button
                    onClick={() => navigate(`/bookkeeping/invoice/${vehicleId}?sale=${encodeURIComponent(v.id)}`)}
                    className="mt-1 text-xs text-yellow-300/80 hover:text-yellow-200"
                  >
                    View the voided invoice
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* PROFIT */}
      <div className="bg-black/40 border border-white/10 p-6 rounded-xl mb-8">
        <h2 className="text-xl font-semibold text-white/80 mb-3">Profit Summary</h2>

        <p><span className="text-white/60">Profit:</span> {profitSummary ? formatMoney(profitSummary.profit) : "—"}</p>
        <p>
          <span className="text-white/60">Margin:</span>{" "}
          {profitSummary && profitSummary.margin !== null ? `${profitSummary.margin.toFixed(1)}%` : "—"}
        </p>
        {!profitSummary && (
          <p className="text-white/60 text-sm mt-2">
            {sale && purchase && isPositiveAmount(purchase.purchasePrice) && !isPositiveAmount(sale.salePrice)
              ? "The sale price is not recorded, so the profit cannot be worked out. Edit the sale and enter the price the car sold for."
              : "Profit is worked out once this car has a recorded purchase price above £0 and a sale."}
          </p>
        )}
      </div>

      {/* TIMELINE */}
      <div className="bg-black/40 border border-white/10 p-6 rounded-xl mb-8">
        <h2 className="text-xl font-semibold text-white/80 mb-3">Timeline</h2>

        <ul className="space-y-2">
          {purchase && (
            <li className="p-3 bg-black/30 border border-white/10 rounded">
              Purchased — {purchase.date}
            </li>
          )}

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
