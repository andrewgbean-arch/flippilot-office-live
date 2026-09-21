import React, { useState } from "react";
import { useBookkeeping } from "./BookkeepingProvider";
import { readMoney } from "@/lib/parseMoney";
import { focusField } from "@/lib/focusField";

interface RecordPurchasePriceModalProps {
  vehicleId: string;
  // The car's own VAT scheme: under the Margin Scheme its purchase carries no VAT.
  scheme: "margin" | "standard";
  vehicleLabel?: string;
  onClose: () => void;
}

// A purchase saved with no usable price (a blank that was once saved as £0, or a price
// that could not be read) reads "Not recorded", and until this there was no way to
// give it one: purchases could not be edited. This records what the car cost on the
// purchase the books already hold, and works out the VAT due on its Margin Scheme
// sale in the same save.
export default function RecordPurchasePriceModal({ vehicleId, scheme, vehicleLabel, onClose }: RecordPurchasePriceModalProps) {
  const { recordPurchasePrice } = useBookkeeping();
  const [price, setPrice] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const priceRead = readMoney(price, { positive: true, blankMessage: "Enter the purchase price." });
  const priceError = priceRead.ok ? null : priceRead.message;
  const showPriceError = priceError !== null && (submitted || price.trim() !== "");

  function handleSave() {
    setSaveError(null);
    if (!priceRead.ok) {
      setSubmitted(true);
      focusField("recordpurchaseprice-price");
      return;
    }
    if (!recordPurchasePrice(vehicleId, priceRead.value, scheme)) {
      setSaveError("Nothing was saved. Check your connection and that your role can record purchases, then try again.");
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-white/80 text-xl font-semibold mb-2">Record Purchase Price</h2>
        <p className="text-white/60 text-sm mb-4">
          {vehicleLabel ? `${vehicleLabel} was` : "This car was"} saved with no usable purchase price. Enter what it really
          cost. Profit is worked out from it{scheme === "margin" ? ", and so is the VAT due on a Margin Scheme sale" : ""}.
        </p>

        <label htmlFor="recordpurchaseprice-price" className="text-white/60 text-sm">Purchase Price (£)</label>
        <input id="recordpurchaseprice-price"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 4500 or £4,500.00"
          aria-invalid={showPriceError}
          aria-describedby={showPriceError ? "recordpurchaseprice-price-error" : undefined}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-1"
        />
        {showPriceError ? (
          <p id="recordpurchaseprice-price-error" role="alert" className="text-red-400 text-sm mb-4">
            {priceError}
          </p>
        ) : (
          <div className="mb-4" />
        )}

        {saveError && (
          <p role="alert" className="text-red-400 text-sm mb-3">
            {saveError}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded font-semibold bg-blue-500 text-black hover:bg-blue-400">
            Save Purchase Price
          </button>
        </div>
      </div>
    </div>
  );
}
