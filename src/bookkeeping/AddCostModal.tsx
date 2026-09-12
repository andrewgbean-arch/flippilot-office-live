import React, { useState } from "react";
import { CostType, CostEntry } from "./types";
import { calculateVat } from "./vatUtils";
import { useBookkeeping } from "./BookkeepingProvider";

interface AddCostModalProps {
  vehicleId: string | null;
  onClose: () => void;
}

export default function AddCostModal({ vehicleId, onClose }: AddCostModalProps) {
  const { addCost } = useBookkeeping();

  const [type, setType] = useState<CostType>("parts");
  const [amount, setAmount] = useState<number>(0);
  const [vatRate, setVatRate] = useState<number>(0.2);
  const [vatIncluded, setVatIncluded] = useState<boolean>(true);
  const [vatReclaimable, setVatReclaimable] = useState<boolean>(true);
  const [supplier, setSupplier] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  function handleSave() {
    if (!vehicleId) {
      alert("You must add a purchase before adding costs.");
      onClose();
      return;
    }

    const breakdown = calculateVat(amount, {
      vatRate,
      vatIncluded,
      vatReclaimable,
    });

    const entry: CostEntry = {
      id: crypto.randomUUID(),
      vehicleId,
      type,
      amount,
      vatRate,
      vatIncluded,
      vatReclaimable,
      vatAmount: breakdown.vat,
      netAmount: breakdown.net,
      supplier,
      notes,
      date,
    };

    addCost(entry);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-lg">
        <h2 className="text-white/80 text-xl font-semibold mb-4">Add Cost</h2>

        {!vehicleId && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded text-red-300 text-sm">
            No vehicle selected — add a purchase first.
          </div>
        )}

        {/* TYPE */}
        <label className="text-white/60 text-sm">Cost Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CostType)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        >
          <option value="purchase">Purchase</option>
          <option value="transport">Transport</option>
          <option value="auction">Auction Fees</option>
          <option value="parts">Parts</option>
          <option value="labour">Labour</option>
          <option value="mot">MOT</option>
          <option value="tyres">Tyres</option>
          <option value="detailing">Detailing</option>
          <option value="advertising">Advertising</option>
          <option value="misc">Misc</option>
        </select>

        {/* AMOUNT */}
        <label className="text-white/60 text-sm">Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
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
          <option value="yes">Yes (amount includes VAT)</option>
          <option value="no">No (VAT added on top)</option>
        </select>

        {/* VAT RECLAIMABLE */}
        <label className="text-white/60 text-sm">VAT Reclaimable?</label>
        <select
          value={vatReclaimable ? "yes" : "no"}
          onChange={(e) => setVatReclaimable(e.target.value === "yes")}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        >
          <option value="yes">Yes (business can reclaim VAT)</option>
          <option value="no">No (VAT is a cost)</option>
        </select>

        {/* SUPPLIER */}
        <label className="text-white/60 text-sm">Supplier</label>
        <input
          type="text"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* NOTES */}
        <label className="text-white/60 text-sm">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
                ? "bg-yellow-500 text-black hover:bg-yellow-400"
                : "bg-gray-600 text-gray-300 cursor-not-allowed"
            }`}
          >
            Save Cost
          </button>
        </div>
      </div>
    </div>
  );
}
