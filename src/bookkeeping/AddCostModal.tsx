import React, { useState } from "react";
import { CostType, CostEntry } from "./types";
import { calculateVat } from "./vatUtils";
import { useBookkeeping } from "./BookkeepingProvider";
import { readMoney, readPercent, percentToRate } from "@/lib/parseMoney";
import { focusField } from "@/lib/focusField";
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
  // A credit or refund is a NEGATIVE cost (money back from a supplier for a part
  // that was returned or a job that was overcharged). It is entered as a positive
  // amount with this ticked, so a stray minus sign is still refused, and it is the
  // way to take off a cost that was entered by mistake.
  const [isCredit, setIsCredit] = useState<boolean>(false);
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
  const amountError = amountRead.ok
    ? null
    : amountRead.reason === "negative"
    ? "Enter the amount without a minus sign. To take money off this car's costs, tick \"This is a credit or refund\"."
    : amountRead.message;
  const showAmountError = amountError !== null && (submitted || amount.trim() !== "");
  // The VAT rate is REQUIRED, read strictly: a blank or unreadable rate used to be
  // saved as 0% VAT without a word.
  const rateRead = readPercent(vatRate);
  const rateError = rateRead.ok ? null : rateRead.message;

  const problems: { field: string; message: string }[] = [];
  if (amountError) problems.push({ field: "addcostmodal-amount", message: amountError });
  if (rateError) problems.push({ field: "addcostmodal-vat-rate", message: rateError });

  function handleSave() {
    if (!vehicleId) {
      alert("Select a vehicle first.");
      return;
    }
    if (!amountRead.ok || !rateRead.ok) {
      setSubmitted(true);
      if (problems[0]) focusField(problems[0].field);
      return;
    }

    // A credit is stored as a negative cost, which lowers the car's total cost.
    const numericAmount = isCredit ? -amountRead.value : amountRead.value;
    const numericVatRate = percentToRate(rateRead.value);

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

        {/* CREDIT OR REFUND */}
        <label htmlFor="addcostmodal-credit" className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <input id="addcostmodal-credit"
            type="checkbox"
            checked={isCredit}
            onChange={(e) => setIsCredit(e.target.checked)}
          />
          This is a credit or refund (it reduces this car's costs)
        </label>

        {/* VAT RATE */}
        <label htmlFor="addcostmodal-vat-rate" className="text-white/60 text-sm">VAT Rate (%)</label>
        <input id="addcostmodal-vat-rate"
          type="number"
          step="any"
          value={vatRate}
          onChange={(e) => setVatRate(e.target.value)}
          placeholder="20"
          aria-invalid={rateError !== null}
          aria-describedby={rateError !== null ? "addcostmodal-vat-rate-error" : undefined}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-1"
        />
        {rateError !== null ? (
          <p id="addcostmodal-vat-rate-error" role="alert" className="text-red-400 text-sm mb-4">
            {rateError}
          </p>
        ) : (
          <div className="mb-4" />
        )}

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

        {/* What stopped the last Save, right beside the button: the field's own message
            can be screens above it in this scrolling form. */}
        {submitted && problems.length > 0 && (
          <p id="addcostmodal-save-error" role="status" className="text-red-400 text-sm mb-3 text-right">
            Can't save yet: {problems[0]!.message}
          </p>
        )}

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