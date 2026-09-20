import React, { useState } from "react";
import { PurchaseEntry } from "./types";
import { calculateVat } from "./vatUtils";
import { purchaseVatSettings } from "./purchaseVat";
import { useBookkeeping } from "./BookkeepingProvider";
import { useInventory } from "@/context/InventoryProvider";
import { readMoney } from "@/lib/parseMoney";

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
  const [source, setSource] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // The purchase price is REQUIRED and must be an amount above £0. A blank used to
  // be saved as £0, and "4,500" used to be lost; either made a later sale look like
  // pure profit. Nothing is saved until the price reads as a real amount.
  const [submitted, setSubmitted] = useState(false);
  const priceRead = readMoney(purchasePrice, { positive: true, blankMessage: "Enter the purchase price." });
  const priceError = priceRead.ok ? null : priceRead.message;
  const showPriceError = priceError !== null && (submitted || purchasePrice.trim() !== "");
  const isMargin = vatScheme === "margin";

  function handleSave() {
    if (!make.trim() || !model.trim()) return;
    if (!priceRead.ok) {
      setSubmitted(true);
      return;
    }

    const numericPrice = priceRead.value;
    // Under the Margin Scheme there is no VAT invoice on the purchase, so the rate
    // is 0 and the price is not "VAT included", whatever the boxes still say. The
    // provider works VAT and net out from what is passed, so it must be right here.
    const { vatRate: numericVatRate, vatIncluded: effectiveVatIncluded } = purchaseVatSettings(
      vatScheme,
      (Number(vatRate) || 0) / 100,
      vatIncluded
    );

    const breakdown = calculateVat(numericPrice, {
      vatRate: numericVatRate,
      vatIncluded: effectiveVatIncluded,
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
      source,
      date,
      vatScheme,
      vatRate: numericVatRate,
      vatIncluded: effectiveVatIncluded,
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
        <label htmlFor="addpurchasemodal-registration-optional" className="text-white/60 text-sm">Registration (optional)</label>
        <input id="addpurchasemodal-registration-optional"
          type="text"
          value={reg}
          onChange={(e) => setReg(e.target.value.toUpperCase())}
          placeholder="AB12 CDE"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* MAKE */}
        <label htmlFor="addpurchasemodal-make" className="text-white/60 text-sm">Make</label>
        <input id="addpurchasemodal-make"
          type="text"
          value={make}
          onChange={(e) => setMake(e.target.value)}
          placeholder="Ford"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* MODEL */}
        <label htmlFor="addpurchasemodal-model" className="text-white/60 text-sm">Model</label>
        <input id="addpurchasemodal-model"
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Fiesta"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* PURCHASE PRICE */}
        <label htmlFor="addpurchasemodal-purchase-price" className="text-white/60 text-sm">Purchase Price (£)</label>
        <input id="addpurchasemodal-purchase-price"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          placeholder="e.g. 4500 or £4,500.00"
          aria-invalid={showPriceError}
          aria-describedby={showPriceError ? "addpurchasemodal-purchase-price-error" : undefined}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-1"
        />
        {showPriceError ? (
          <p id="addpurchasemodal-purchase-price-error" role="alert" className="text-red-400 text-sm mb-4">
            {priceError}
          </p>
        ) : (
          <div className="mb-4" />
        )}

        {/* VAT SCHEME */}
        <label htmlFor="addpurchasemodal-vat-scheme-for-when-this-vehicle-is-sold" className="text-white/60 text-sm">VAT Scheme (for when this vehicle is sold)</label>
        <select id="addpurchasemodal-vat-scheme-for-when-this-vehicle-is-sold"
          value={vatScheme}
          onChange={(e) => setVatScheme(e.target.value as "margin" | "standard")}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        >
          <option value="margin">Margin Scheme — no VAT invoice on purchase (private seller, trade-in, most used cars)</option>
          <option value="standard">Standard VAT — VAT invoice received on purchase</option>
        </select>

        {isMargin ? (
          <p role="note" className="mb-4 px-3 py-2 rounded bg-black/30 border border-yellow-400/20 text-sm text-yellow-300/90">
            Margin Scheme purchases carry no VAT, so no VAT rate applies and none is recorded.
          </p>
        ) : (
          <>
            {/* VAT RATE */}
            <label htmlFor="addpurchasemodal-vat-rate-on-this-purchase" className="text-white/60 text-sm">VAT Rate on this Purchase (%)</label>
            <input id="addpurchasemodal-vat-rate-on-this-purchase"
              type="number"
              step="1"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              placeholder="20"
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
            />

            {/* VAT INCLUDED */}
            <label htmlFor="addpurchasemodal-vat-included" className="text-white/60 text-sm">VAT Included?</label>
            <select id="addpurchasemodal-vat-included"
              value={vatIncluded ? "yes" : "no"}
              onChange={(e) => setVatIncluded(e.target.value === "yes")}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
            >
              <option value="yes">Yes (price includes VAT)</option>
              <option value="no">No (VAT added on top)</option>
            </select>
          </>
        )}

        {/* PURCHASED FROM */}
        <label htmlFor="addpurchasemodal-purchased-from" className="text-white/60 text-sm">Purchased From</label>
        <input id="addpurchasemodal-purchased-from"
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Trade-in, Auction, Private Sale, BCA..."
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* DATE */}
        <label htmlFor="addpurchasemodal-date" className="text-white/60 text-sm">Date</label>
        <input id="addpurchasemodal-date"
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
