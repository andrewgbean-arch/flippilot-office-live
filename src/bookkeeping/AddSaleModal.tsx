import React, { useState } from "react";
import { SaleEntry } from "./types";
import { calculateVat } from "./vatUtils";
import { useBookkeeping } from "./BookkeepingProvider";

interface AddSaleModalProps {
  vehicleId: string | null;
  onClose: () => void;
}

export default function AddSaleModal({ vehicleId, onClose }: AddSaleModalProps) {
  const { addSale } = useBookkeeping();

  const [salePrice, setSalePrice] = useState<number>(0);
  const [vatRate, setVatRate] = useState<number>(0.2);
  const [vatIncluded, setVatIncluded] = useState<boolean>(true);
  const [buyer, setBuyer] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  function handleSave() {
    if (!vehicleId) {
      alert("You must add a purchase before recording a sale.");
      onClose();
      return;
    }

    const breakdown = calculateVat(salePrice, {
      vatRate,
      vatIncluded,
      vatReclaimable: false, // sales VAT is NOT reclaimable
    });

    const entry: SaleEntry = {
      id: crypto.randomUUID(),
      vehicleId,
      salePrice,
      buyer,
      date,
      vatRate,
      vatIncluded,
      vatAmount: breakdown.vat,
      netAmount: breakdown.net,
    };

    addSale(entry);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-lg">
        <h2 className="text-white/80 text-xl font-semibold mb-4">Record Vehicle Sale</h2>

        {!vehicleId && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded text-red-300 text-sm">
            No vehicle selected — add a purchase first.
          </div>
        )}

        {/* SALE PRICE */}
        <label className="text-white/60 text-sm">Sale Price</label>
        <input
          type="number"
          value={salePrice}
          onChange={(e) => setSalePrice(Number(e.target.value))}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* VAT RATE */}
        <label className="text-white/60 text-sm">VAT Rate</label>
        <input
          type="number"
          step="0.01"
          value={vatRate}
          onChange={(e) => setVatRate(Number(e.target.value))}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* VAT INCLUDED */}
        <label className="text-white/60 text-sm">VAT Included?</label>
        <select
          value={vatIncluded ? "yes" : "no"}
          onChange={(e) => setVatIncluded(e.target.value === "yes")}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        >
          <option value="yes">Yes (price includes VAT)</option>
          <option value="no">No (VAT added on top)</option>
        </select>

        {/* BUYER */}
        <label className="text-white/60 text-sm">Buyer</label>
        <input
          type="text"
          value={buyer}
          onChange={(e) => setBuyer(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* DATE */}
        <label className="text-white/60 text-sm">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-6"
        />

        {/* BUTTONS */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={!vehicleId}
            className={`px-4 py-2 rounded font-semibold ${
              vehicleId
                ? "bg-green-500 text-black hover:bg-green-400"
                : "bg-gray-600 text-gray-300 cursor-not-allowed"
            }`}
          >
            Save Sale
          </button>
        </div>
      </div>
    </div>
  );
}
