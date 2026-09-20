import React, { useState } from "react";
import { CostType, CostEntry } from "./types";
import { calculateVat } from "./vatUtils";
import { useBookkeeping } from "./BookkeepingProvider";
import { readMoney } from "@/lib/parseMoney";
import VehiclePicker from "./VehiclePicker";

interface AddCostModalProps {
  vehicleId: string | null;
  onClose: () => void;
}

export default function AddCostModal({ vehicleId: initialVehicleId, onClose }: AddCostModalProps) {
  const { addCost } = useBookkeeping();

  // Was a fixed prop with no way to change it — now an editable
  // selection, defaulting to whatever the caller suggested.
  const [vehicleId, setVehicleId] = useState<string | null>(initialVehicleId);
  const [type, setType] = useState<CostType>("parts");
  const [amount, setAmount] = useState<string>("");
  const [vatRate, setVatRate] = useState<string>("20");
  const [vatIncluded, setVatIncluded] = useState<boolean>(true);
  const [vatReclaimable, setVatReclaimable] = useState<boolean>(true);
  const [supplier, setSupplier] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // The amount is REQUIRED and must be above £0: a blank used to be saved as a £0
  // cost, and "£120" or "1,200" was read as nothing.
  const [submitted, setSubmitted] = useState(false);
  const amountRead = readMoney(amount, { positive: true, blankMessage: "Enter the cost amount." });
  const amountError = amountRead.ok ? null : amountRead.message;
  const showAmountError = amountError !== null && (submitted || amount.trim() !== "");

  function handleSave() {
    if (!vehicleId) {
      alert("Select a vehicle first.");
      return;
    }
    if (!amountRead.ok) {
      setSubmitted(true);
      return;
    }

    const numericAmount = amountRead.value;
    const numericVatRate = (Number(vatRate) || 0) / 100;

    const breakdown = calculateVat(numericAmount, {
      vatRate: numericVatRate,
      vatIncluded,
      vatReclaimable,
    });

    const entry: CostEntry = {
      id: crypto.randomUUID(),
      vehicleId,
      type,
      amount: numericAmount,
      vatRate: numericVatRate,
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-white/80 text-xl font-semibold mb-4">Add Cost</h2>

        {/* VEHICLE */}
        <label className="text-white/60 text-sm">Vehicle</label>
        <VehiclePicker value={vehicleId} onChange={setVehicleId} />

        {/* TYPE */}
        <label htmlFor="addcostmodal-cost-type" className="text-white/60 text-sm">Cost Type</label>
        <select id="addcostmodal-cost-type"
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
        <label htmlFor="addcostmodal-amount" className="text-white/60 text-sm">Amount (£)</label>
        <input id="addcostmodal-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 120 or £120.00"
          aria-invalid={showAmountError}
          aria-describedby={showAmountError ? "addcostmodal-amount-error" : undefined}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-1"
        />
        {showAmountError ? (
          <p id="addcostmodal-amount-error" role="alert" className="text-red-400 text-sm mb-4">
            {amountError}
          </p>
        ) : (
          <div className="mb-4" />
        )}

        {/* VAT RATE */}
        <label htmlFor="addcostmodal-vat-rate" className="text-white/60 text-sm">VAT Rate (%)</label>
        <input id="addcostmodal-vat-rate"
          type="number"
          step="1"
          value={vatRate}
          onChange={(e) => setVatRate(e.target.value)}
          placeholder="20"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* VAT INCLUDED */}
        <label htmlFor="addcostmodal-vat-included" className="text-white/60 text-sm">VAT Included?</label>
        <select id="addcostmodal-vat-included"
          value={vatIncluded ? "yes" : "no"}
          onChange={(e) => setVatIncluded(e.target.value === "yes")}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        >
          <option value="yes">Yes (amount includes VAT)</option>
          <option value="no">No (VAT added on top)</option>
        </select>

        {/* VAT RECLAIMABLE */}
        <label htmlFor="addcostmodal-vat-reclaimable" className="text-white/60 text-sm">VAT Reclaimable?</label>
        <select id="addcostmodal-vat-reclaimable"
          value={vatReclaimable ? "yes" : "no"}
          onChange={(e) => setVatReclaimable(e.target.value === "yes")}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        >
          <option value="yes">Yes (business can reclaim VAT)</option>
          <option value="no">No (VAT is a cost)</option>
        </select>

        {/* SUPPLIER */}
        <label htmlFor="addcostmodal-supplier" className="text-white/60 text-sm">Supplier</label>
        <input id="addcostmodal-supplier"
          type="text"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* NOTES */}
        <label htmlFor="addcostmodal-notes" className="text-white/60 text-sm">Notes</label>
        <textarea id="addcostmodal-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* DATE */}
        <label htmlFor="addcostmodal-date" className="text-white/60 text-sm">Date</label>
        <input id="addcostmodal-date"
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