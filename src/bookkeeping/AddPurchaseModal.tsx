import React, { useState } from "react";
import { PurchaseEntry } from "./types";
import { calculateVat } from "./vatUtils";
import { useBookkeeping } from "./BookkeepingProvider";

interface AddPurchaseModalProps {
  vehicleId: string | null; // now allowed
  onClose: () => void;
}

export default function AddPurchaseModal({ vehicleId, onClose }: AddPurchaseModalProps) {
  const { addPurchase } = useBookkeeping();

  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [vatRate, setVatRate] = useState<number>(0.2);
  const [vatIncluded, setVatIncluded] = useState<boolean>(true);
  const [supplier, setSupplier] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  function handleSave() {
    // ⭐ ALWAYS CREATE A NEW VEHICLE ID
    const newVehicleId = crypto.randomUUID();

    const breakdown = calculateVat(purchasePrice, {
      vatRate,
      vatIncluded,
      vatReclaimable: true, // purchases reclaim VAT
    });

    const entry: PurchaseEntry = {
      id: crypto.randomUUID(),
      vehicleId: newVehicleId, // ⭐ FIXED — always a string
      purchasePrice,
      supplier,
      date,
      vatRate,
      vatIncluded,
      vatAmount: breakdown.vat,
      netAmount: breakdown.net,
    };

    addPurchase(entry);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-lg">
        <h2 className="text-white/80 text-xl font-semibold mb-4">Add Vehicle Purchase</h2>

        {/* PURCHASE PRICE */}
        <label className="text-white/60 text-sm">Purchase Price</label>
        <input
          type="number"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(Number(e.target.value))}
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

        {/* SUPPLIER */}
        <label className="text-white/60 text-sm">Supplier</label>
        <input
          type="text"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
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
            className="px-4 py-2 rounded bg-blue-500 text-black font-semibold hover:bg-blue-400"
          >
            Save Purchase
          </button>
        </div>
      </div>
    </div>
  );
}
