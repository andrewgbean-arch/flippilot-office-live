import React, { useState } from "react";
import { useBookkeeping } from "./BookkeepingProvider";
import { useInventory } from "@/context/InventoryProvider";
import { useAuth } from "@/context/AuthContext";
import { formatMoney } from "@/lib/formatMoney";
import type { SaleEntry } from "./types";

interface VoidSaleModalProps {
  sale: SaleEntry;
  vehicleLabel?: string;
  onClose: () => void;
}

// Voiding a sale recorded by mistake (saleStatus.ts). It can't be undone, so it asks
// for a reason, says plainly what happens, and offers to put the car back in stock
// (on by default: a car whose sale fell through is for sale again).
export default function VoidSaleModal({ sale, vehicleLabel, onClose }: VoidSaleModalProps) {
  const { voidSale } = useBookkeeping();
  const { updateVehicle } = useInventory();
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const reasonError = reason.trim() ? null : "Say why this sale is being voided.";

  function handleVoid() {
    setSaveError(null);
    if (reasonError) {
      setSubmitted(true);
      return;
    }
    if (!voidSale(sale.id, reason, user?.name ?? "Unknown")) {
      setSaveError("Nothing was saved. Check your connection and that your role can change the books, then try again.");
      return;
    }
    if (restock) updateVehicle(sale.vehicleId, { status: "new" });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 border border-red-400/30 p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-red-300 text-xl font-semibold mb-2">Void Sale</h2>
        <p className="text-white/70 text-sm mb-2">
          Invoice {sale.invoiceNumber} for {vehicleLabel || "this car"}, {formatMoney(sale.salePrice)}.
        </p>
        <p className="text-white/60 text-sm mb-4">
          Use this for a sale recorded by mistake or one that fell through. The sale stays in the books marked VOID, its
          invoice number is never used again, and it is left out of profit, income, VAT and sales figures. This can't be undone.
        </p>

        <label htmlFor="voidsale-reason" className="text-white/60 text-sm">Reason</label>
        <textarea id="voidsale-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Recorded on the wrong car; the buyer pulled out"
          aria-invalid={submitted && reasonError !== null}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-1"
        />
        {submitted && reasonError ? (
          <p role="alert" className="text-red-400 text-sm mb-3">{reasonError}</p>
        ) : (
          <div className="mb-3" />
        )}

        <label className="flex items-center gap-2 text-white/70 text-sm mb-4">
          <input id="voidsale-restock" type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          Put the car back in stock
        </label>

        {saveError && <p role="alert" className="text-red-400 text-sm mb-3">{saveError}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20">
            Cancel
          </button>
          <button onClick={handleVoid} className="px-4 py-2 rounded font-semibold bg-red-500 text-white hover:bg-red-400">
            Void Sale
          </button>
        </div>
      </div>
    </div>
  );
}
