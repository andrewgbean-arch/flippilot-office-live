import React, { useState } from "react";
import { PurchaseEntry } from "./types";
import { calculateVat } from "./vatUtils";
import { useBookkeeping } from "./BookkeepingProvider";
import { useInventory } from "@/context/InventoryProvider";

interface AddPurchaseModalProps {
  vehicleId: string | null;
  onClose: () => void;
}

export default function AddPurchaseModal({ onClose }: AddPurchaseModalProps) {
  const { addPurchase } = useBookkeeping();
  const { addManualVehicle } = useInventory();

  const [reg, setReg] = useState<string>("");
  const [make, setMake] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [vatScheme, setVatScheme] = useState<"margin" | "standard">("margin");
  const [vatRate, setVatRate] = useState<string>("20");
  const [vatIncluded, setVatIncluded] = useState<boolean>(true);
  const [supplier, setSupplier] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  function handleSave() {
    if (!make.trim() || !model.trim()) return;

    const numericPrice = Number(purchasePrice) || 0;
    const numericVatRate = (Number(vatRate) || 0) / 100;

    const breakdown = calculateVat(numericPrice, {
      vatRate: numericVatRate,
      vatIncluded,
      vatReclaimable: true,
    });

    // This used to record the purchase against a brand new random UUID
    // that had no corresponding vehicle anywhere — the ledger would show
    // a meaningless ID forever, and the "vehicle" it referred to never
    // actually existed in the real inventory. Now it creates a real
    // vehicle (same as the New Vehicle screen) so a purchase made here
    // actually shows up in stock.
    const newVehicle = addManualVehicle({
      reg: reg || null,
      make,
      model,
      buyPrice: numericPrice,
      vatScheme,
    });

    const entry: PurchaseEntry = {
      id: crypto.randomUUID(),
      vehicleId: newVehicle.id,
      purchasePrice: numericPrice,
      supplier,
      date,
      vatRate: numericVatRate,
      vatIncluded,
      vatAmount: breakdown.vat,
      netAmount: breakdown.net,
    };

    addPurchase(entry);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-white/80 text-xl font-semibold mb-4">Add Vehicle Purchase</h2>

        {/* REGISTRATION */}
        <label className="text-white/60 text-sm">Registration (optional)</label>
        <input
          type="text"
          value={reg}
          onChange={(e) => setReg(e.target.value.toUpperCase())}
          placeholder="AB12 CDE"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* MAKE */}
        <label className="text-white/60 text-sm">Make</label>
        <input
          type="text"
          value={make}
          onChange={(e) => setMake(e.target.value)}
          placeholder="Ford"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* MODEL */}
        <label className="text-white/60 text-sm">Model</label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Fiesta"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* PURCHASE PRICE */}
        <label className="text-white/60 text-sm">Purchase Price</label>
        <input
          type="number"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          placeholder="0.00"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* VAT SCHEME */}
        <label className="text-white/60 text-sm">VAT Scheme (for when this vehicle is sold)</label>
        <select
          value={vatScheme}
          onChange={(e) => setVatScheme(e.target.value as "margin" | "standard")}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        >
          <option value="margin">Margin Scheme — no VAT invoice on purchase (private seller, trade-in, most used cars)</option>
          <option value="standard">Standard VAT — VAT invoice received on purchase</option>
        </select>

        {/* VAT RATE */}
        <label className="text-white/60 text-sm">VAT Rate on this Purchase (%)</label>
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

        {/* SUPPLIER */}
        <label className="text-white/60 text-sm">Supplier</label>
        <input
          type="text"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          placeholder="Trade-in, Auction, Private Sale, BCA..."
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
            disabled={!make.trim() || !model.trim()}
            className={`px-4 py-2 rounded font-semibold ${
              make.trim() && model.trim()
                ? "bg-blue-500 text-black hover:bg-blue-400"
                : "bg-gray-600 text-gray-300 cursor-not-allowed"
            }`}
          >
            Save Purchase
          </button>
        </div>
      </div>
    </div>
  );
}
