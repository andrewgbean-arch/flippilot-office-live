import React, { useState } from "react";
import { useBookkeeping } from "./BookkeepingProvider";
import type { PurchaseEntry } from "./types";
import { readMoney, readPercent, percentToRate } from "@/lib/parseMoney";
import { focusField } from "@/lib/focusField";

interface RecordPurchasePriceModalProps {
  vehicleId: string;
  // The car's own VAT scheme: under the Margin Scheme its purchase carries no VAT.
  scheme: "margin" | "standard";
  vehicleLabel?: string;
  // false when the books hold no purchase for this car at all: one is then
  // attached to the car, so the date (and, for Standard VAT, the rate) is asked too.
  hasPurchase?: boolean;
  // Given to correct a purchase that already has a price: the form opens filled in
  // with it, and saving changes that purchase (editPurchase).
  existing?: PurchaseEntry;
  onClose: () => void;
}

// A stored VAT rate (0.2) as the form shows it ("20").
const ratePercent = (rate: number | undefined) =>
  typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? String(Math.round(rate * 10000) / 100) : "20";

// Today as the dealer sees it (YYYY-MM-DD), not UTC's.
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A purchase saved with no usable price (a blank that was once saved as £0, or a price
// that could not be read) reads "Not recorded", and until this there was no way to
// give it one: purchases could not be edited. This records what the car cost on the
// purchase the books already hold, and works out the VAT due on its Margin Scheme
// sale in the same save. A car with no purchase at all (a sold car imported from a
// spreadsheet, say) gets one attached to it here, rather than a second copy of the
// car being made through Add Purchase.
export default function RecordPurchasePriceModal({ vehicleId, scheme, vehicleLabel, hasPurchase = true, existing, onClose }: RecordPurchasePriceModalProps) {
  const { recordPurchasePrice, editPurchase } = useBookkeeping();
  const editing = existing !== undefined;
  const creating = !hasPurchase && !editing;
  // Creating and editing ask for the whole purchase; fixing a "Not recorded" price asks only the price.
  const full = creating || editing;
  const [price, setPrice] = useState(editing ? String(existing!.purchasePrice) : "");
  const [date, setDate] = useState(editing && /^\d{4}-\d{2}-\d{2}/.test(existing!.date) ? existing!.date.slice(0, 10) : todayLocal());
  const [source, setSource] = useState(editing ? existing!.source ?? "" : "");
  const [vatRate, setVatRate] = useState(editing ? ratePercent(existing!.vatRate) : "20");
  const [vatIncluded, setVatIncluded] = useState(editing ? existing!.vatIncluded !== false : true);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const priceRead = readMoney(price, { positive: true, blankMessage: "Enter the purchase price." });
  const priceError = priceRead.ok ? null : priceRead.message;
  const showPriceError = priceError !== null && (submitted || price.trim() !== "");

  const dateError = full && !/^\d{4}-\d{2}-\d{2}$/.test(date) ? "Enter the date the car was bought." : null;
  // Only a Standard VAT purchase has a rate; it is required then, never assumed.
  const rateRead = readPercent(vatRate);
  const rateError = full && scheme === "standard" && !rateRead.ok ? rateRead.message : null;

  function handleSave() {
    setSaveError(null);
    if (!priceRead.ok || dateError || rateError) {
      setSubmitted(true);
      focusField(!priceRead.ok ? "recordpurchaseprice-price" : dateError ? "recordpurchaseprice-date" : "recordpurchaseprice-vat-rate");
      return;
    }
    const rate = scheme === "standard" && rateRead.ok ? percentToRate(rateRead.value) : 0;
    const included = scheme === "standard" ? vatIncluded : false;
    const saved = editing
      ? editPurchase(vehicleId, { purchasePrice: priceRead.value, date, source, vatScheme: scheme, vatRate: rate, vatIncluded: included })
      : recordPurchasePrice(vehicleId, priceRead.value, scheme, creating ? { date, source, vatRate: rate, vatIncluded: included } : undefined);
    if (!saved) {
      setSaveError("Nothing was saved. Check your connection and that your role can record purchases, then try again.");
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-white/80 text-xl font-semibold mb-2">{editing ? "Edit Purchase" : creating ? "Record What You Paid" : "Record Purchase Price"}</h2>
        <p className="text-white/60 text-sm mb-4">
          {editing
            ? `Correct what ${vehicleLabel || "this car"} cost, when it was bought or where from.`
            : creating
            ? `${vehicleLabel || "This car"} has no purchase in the books. Enter what it cost and when you bought it.`
            : `${vehicleLabel ? `${vehicleLabel} was` : "This car was"} saved with no usable purchase price. Enter what it really cost.`}{" "}
          Profit is worked out from it{scheme === "margin" ? ", and so is the VAT due on a Margin Scheme sale" : ""}.
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

        {full && (
          <>
            <label htmlFor="recordpurchaseprice-date" className="text-white/60 text-sm">Date Bought</label>
            <input id="recordpurchaseprice-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={submitted && dateError !== null}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-1"
            />
            {submitted && dateError ? (
              <p role="alert" className="text-red-400 text-sm mb-4">{dateError}</p>
            ) : (
              <div className="mb-4" />
            )}

            <label htmlFor="recordpurchaseprice-source" className="text-white/60 text-sm">Bought From (optional)</label>
            <input id="recordpurchaseprice-source"
              type="text"
              autoComplete="off"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. BCA auction, part exchange"
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
            />

            {scheme === "standard" ? (
              <>
                <label htmlFor="recordpurchaseprice-vat-rate" className="text-white/60 text-sm">VAT Rate on This Purchase (%)</label>
                <input id="recordpurchaseprice-vat-rate"
                  type="text"
                  inputMode="decimal"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  aria-invalid={submitted && rateError !== null}
                  className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-1"
                />
                {submitted && rateError && <p role="alert" className="text-red-400 text-sm mb-2">{rateError}</p>}
                <label className="flex items-center gap-2 text-white/60 text-sm mb-4 mt-2">
                  <input type="checkbox" checked={vatIncluded} onChange={(e) => setVatIncluded(e.target.checked)} />
                  The price includes VAT
                </label>
              </>
            ) : (
              <p className="text-white/50 text-xs mb-4">Bought under the Margin Scheme: there is no VAT on the purchase.</p>
            )}
          </>
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
            {editing ? "Save Changes" : "Save Purchase Price"}
          </button>
        </div>
      </div>
    </div>
  );
}
