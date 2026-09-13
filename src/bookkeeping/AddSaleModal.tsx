import React, { useState } from "react";
import { SaleEntry } from "./types";
import { calculateVat } from "./vatUtils";
import { useBookkeeping } from "./BookkeepingProvider";
import { useInventory } from "@/context/InventoryProvider";
import VehiclePicker from "./VehiclePicker";

interface AddSaleModalProps {
  vehicleId: string | null;
  onClose: () => void;
}

export default function AddSaleModal({ vehicleId: initialVehicleId, onClose }: AddSaleModalProps) {
  const { addSale } = useBookkeeping();
  const { updateVehicleSale } = useInventory();

  // Was a fixed prop with no way to change it — now an editable
  // selection, defaulting to whatever the caller suggested.
  const [vehicleId, setVehicleId] = useState<string | null>(initialVehicleId);
  const [salePrice, setSalePrice] = useState<string>("");
  const [vatRate, setVatRate] = useState<string>("20");
  const [vatIncluded, setVatIncluded] = useState<boolean>(true);
  const [buyer, setBuyer] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  function handleSave() {
    if (!vehicleId) {
      alert("Select a vehicle first.");
      return;
    }

    const numericPrice = Number(salePrice) || 0;
    const numericVatRate = (Number(vatRate) || 0) / 100;

    const breakdown = calculateVat(numericPrice, {
      vatRate: numericVatRate,
      vatIncluded,
      vatReclaimable: false,
    });

    const entry: SaleEntry = {
      id: crypto.randomUUID(),
      vehicleId,
      salePrice: numericPrice,
      buyer,
      date,
      vatRate: numericVatRate,
      vatIncluded,
      vatAmount: breakdown.vat,
      netAmount: breakdown.net,
    };

    addSale(entry);
    updateVehicleSale(vehicleId, numericPrice);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-white/80 text-xl font-semibold mb-4">Record Vehicle Sale</h2>

        {/* VEHICLE */}
        <label className="text-white/60 text-sm">Vehicle</label>
        <VehiclePicker value={vehicleId} onChange={setVehicleId} />

        {/* SALE PRICE */}
        <label className="text-white/60 text-sm">Sale Price</label>
        <input
          type="number"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          placeholder="0.00"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* VAT RATE */}
        <label className="text-white/60 text-sm">VAT Rate (%)</label>
        <input
          type="number"
          step="1"
          value={vatRate}
          onChange={(e) => setVatRate(e.target.value)}
          placeholder="20"
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