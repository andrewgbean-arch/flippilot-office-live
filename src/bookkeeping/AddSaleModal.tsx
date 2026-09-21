import { formatMoney } from "@/lib/formatMoney";
import React, { useState, useMemo } from "react";
import { SaleEntry } from "./types";
import { withSaleVat } from "./saleVat";
import { marginVatForSale } from "./vatUtils";
import { nextInvoiceNumber } from "./invoiceUtils";
import { useBookkeeping } from "./BookkeepingProvider";
import { useInventory } from "@/context/InventoryProvider";
import { toDateKey } from "@/planner/dateUtils";
import { readMoney, readPercent, percentToRate, rateToPercentText, isPositiveAmount } from "@/lib/parseMoney";
import { focusField } from "@/lib/focusField";
import VehiclePicker from "./VehiclePicker";

interface AddSaleModalProps {
  vehicleId: string | null;
  existing?: SaleEntry;
  onClose: () => void;
}

export default function AddSaleModal({ vehicleId: initialVehicleId, existing, onClose }: AddSaleModalProps) {
  const { sales, addSale, updateSale, getPurchaseForVehicle } = useBookkeeping();
  const { vehicles, updateVehicleSale } = useInventory();

  // Was a fixed prop with no way to change it — now an editable
  // selection, defaulting to whatever the caller suggested.
  const [vehicleId, setVehicleId] = useState<string | null>(existing?.vehicleId ?? initialVehicleId);
  const [salePrice, setSalePrice] = useState<string>(existing ? String(existing.salePrice) : "");
  const [vatRate, setVatRate] = useState<string>(existing ? rateToPercentText(existing.vatRate) : "20");
  const [vatIncluded, setVatIncluded] = useState<boolean>(existing?.vatIncluded ?? true);
  const [buyer, setBuyer] = useState<string>(existing?.buyer ?? "");
  const [buyerEmail, setBuyerEmail] = useState<string>(existing?.buyerEmail ?? "");
  const [buyerPhone, setBuyerPhone] = useState<string>(existing?.buyerPhone ?? "");
  const [buyerAddress, setBuyerAddress] = useState<string>(existing?.buyerAddress ?? "");
  const [date, setDate] = useState<string>(existing?.date ?? toDateKey(new Date()));

  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const purchase = vehicleId ? getPurchaseForVehicle(vehicleId) : undefined;

  // The scheme is the car's own. A Margin Scheme sale needs the car's purchase price
  // to work out the VAT due, and a purchase saved with no usable price (0, nothing,
  // text, a negative) is NOT a price: it is never used as a cost of £0. Without a real
  // one there is no VAT figure to show or store (see saleVat.ts), and the sale is NOT
  // switched to standard VAT either: the sale stays a Margin Scheme sale.
  const isMarginScheme = vehicle?.vatScheme === "margin";
  const purchaseRecorded = isPositiveAmount(purchase?.purchasePrice);

  // The sale price is REQUIRED and must be an amount above £0. A blank used to be
  // saved as a £0 sale (and the car marked SOLD at £0, printing "-Infinity%"), and
  // "£5,000" was read as nothing. Nothing is saved, and no car is marked sold,
  // until the price reads as a real amount.
  const [submitted, setSubmitted] = useState(false);
  const priceRead = readMoney(salePrice, { positive: true, blankMessage: "Enter the sale price." });
  const priceError = priceRead.ok ? null : priceRead.message;
  const showPriceError = priceError !== null && (submitted || salePrice.trim() !== "");
  // The VAT rate is REQUIRED too, and read strictly: a blank or unreadable rate used
  // to become 0% without a word, and "0.2" was saved as 0.2%. The box starts at 20,
  // so any message about it is one to show straight away.
  const rateRead = readPercent(vatRate);
  const rateError = rateRead.ok ? null : rateRead.message;
  // null while the price or rate is blank or unreadable: the preview then shows
  // dashes, not a made-up £0 margin.
  const previewPrice = priceRead.ok ? priceRead.value : null;
  const numericVatRate = rateRead.ok ? percentToRate(rateRead.value) : null;

  const marginPreview = useMemo(
    () => (isMarginScheme ? marginVatForSale(previewPrice, purchase?.purchasePrice, numericVatRate) : null),
    [isMarginScheme, purchase, previewPrice, numericVatRate]
  );

  // What is wrong with the form, first problem first, for the line beside Save.
  const problems: { field: string; message: string }[] = [];
  if (priceError) problems.push({ field: "addsalemodal-sale-price", message: priceError });
  if (rateError) problems.push({ field: "addsalemodal-vat-rate", message: rateError });

  function handleSave() {
    if (!vehicleId) {
      alert("Select a vehicle first.");
      return;
    }
    if (!priceRead.ok || !rateRead.ok) {
      setSubmitted(true);
      if (problems[0]) focusField(problems[0].field);
      return;
    }
    const numericPrice = priceRead.value;
    const rate = percentToRate(rateRead.value);

    // Only includes a contact field when it has a value — matches this
    // project's established optional-field convention under
    // exactOptionalPropertyTypes. One real limitation this brings when
    // editing an existing sale: blanking a field back out won't clear
    // it (there's nothing to distinguish "leave unchanged" from
    // "clear it" in a plain conditional spread) — typing a replacement
    // value works fine, only intentionally emptying an already-set
    // field doesn't take effect.
    const contactFields = {
      ...(buyer.trim() ? { buyer: buyer.trim() } : {}),
      ...(buyerEmail.trim() ? { buyerEmail: buyerEmail.trim() } : {}),
      ...(buyerPhone.trim() ? { buyerPhone: buyerPhone.trim() } : {}),
      ...(buyerAddress.trim() ? { buyerAddress: buyerAddress.trim() } : {}),
    };

    if (existing) {
      updateSale(existing.id, {
        vehicleId,
        salePrice: numericPrice,
        date,
        vatScheme: isMarginScheme ? "margin" : "standard",
        vatRate: rate,
        vatIncluded,
        ...contactFields,
      });
      onClose();
      return;
    }

    // The VAT and net come from the one shared function (saleVat.ts), which the
    // provider applies again when it stores the sale: null when they cannot be
    // worked out, never a figure made up to fill the gap.
    const entry: SaleEntry = withSaleVat(
      {
        id: crypto.randomUUID(),
        vehicleId,
        salePrice: numericPrice,
        invoiceNumber: nextInvoiceNumber(sales),
        date,
        vatScheme: isMarginScheme ? "margin" : "standard",
        vatRate: rate,
        vatIncluded,
        vatAmount: null,
        netAmount: null,
        ...contactFields,
      },
      purchase
    );

    addSale(entry);
    updateVehicleSale(vehicleId, numericPrice);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-white/80 text-xl font-semibold mb-4">{existing ? "Edit Sale" : "Record Vehicle Sale"}</h2>

        {/* VEHICLE */}
        <label className="text-white/60 text-sm">Vehicle</label>
        <VehiclePicker value={vehicleId} onChange={setVehicleId} />

        {/* SALE PRICE */}
        <label htmlFor="addsalemodal-sale-price" className="text-white/60 text-sm">Sale Price (£)</label>
        <input id="addsalemodal-sale-price"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          placeholder="e.g. 6500 or £6,500.00"
          aria-invalid={showPriceError}
          aria-describedby={showPriceError ? "addsalemodal-sale-price-error" : undefined}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-1"
        />
        {showPriceError ? (
          <p id="addsalemodal-sale-price-error" role="alert" className="text-red-400 text-sm mb-4">
            {priceError}
          </p>
        ) : (
          <div className="mb-4" />
        )}

        {/* VAT SCHEME — read-only, driven by the vehicle itself (set
            when it was added/edited), not chosen per sale */}
        {vehicle && (
          <div className="mb-4 px-3 py-2 rounded bg-black/30 border border-white/10 text-sm">
            {vehicle.vatScheme === "margin" ? (
              purchaseRecorded ? (
                <span className="text-yellow-300/90">
                  VAT Margin Scheme — VAT is due on the profit margin only, not the sale price.
                </span>
              ) : (
                <span role="note" className="text-orange-300/90">
                  This vehicle is set to the Margin Scheme, but has no purchase price on record, so the
                  VAT due can't be worked out yet. The sale is saved without a VAT figure (it is not
                  switched to standard VAT), and the VAT due is filled in once the purchase price is
                  recorded on the car's ledger page.
                </span>
              )
            ) : (
              <span className="text-white/60">Standard VAT — charged on the full sale price.</span>
            )}
          </div>
        )}

        {/* VAT RATE */}
        <label htmlFor="addsalemodal-vat-rate" className="text-white/60 text-sm">VAT Rate (%)</label>
        <input id="addsalemodal-vat-rate"
          type="number"
          step="any"
          value={vatRate}
          onChange={(e) => setVatRate(e.target.value)}
          placeholder="20"
          aria-invalid={rateError !== null}
          aria-describedby={rateError !== null ? "addsalemodal-vat-rate-error" : undefined}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-1"
        />
        {rateError !== null ? (
          <p id="addsalemodal-vat-rate-error" role="alert" className="text-red-400 text-sm mb-4">
            {rateError}
          </p>
        ) : (
          <div className="mb-4" />
        )}

        {isMarginScheme ? (
          /* MARGIN SCHEME BREAKDOWN — replaces "VAT Included?", which
             doesn't apply here: the sale price is just the sale price,
             margin VAT is a separately-calculated liability on top of
             the purchase/sale gap, not extracted from or added to it. */
          <div className="mb-4 px-3 py-3 rounded bg-black/40 border border-yellow-400/20 text-sm space-y-1">
            <div className="flex justify-between text-white/60">
              <span>Purchase Price</span>
              <span>{purchaseRecorded ? formatMoney(purchase?.purchasePrice, { pence: true }) : "Not recorded"}</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Margin</span>
              <span>{formatMoney(marginPreview?.margin, { pence: true })}</span>
            </div>
            <div className="flex justify-between text-yellow-300 font-semibold pt-1 border-t border-white/10 mt-1">
              <span>VAT Due (Margin Scheme)</span>
              <span>{formatMoney(marginPreview?.vat, { pence: true })}</span>
            </div>
          </div>
        ) : (
          /* VAT INCLUDED */
          <>
            <label htmlFor="addsalemodal-vat-included" className="text-white/60 text-sm">VAT Included?</label>
            <select id="addsalemodal-vat-included"
              value={vatIncluded ? "yes" : "no"}
              onChange={(e) => setVatIncluded(e.target.value === "yes")}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
            >
              <option value="yes">Yes (price includes VAT)</option>
              <option value="no">No (VAT added on top)</option>
            </select>
          </>
        )}

        {/* BUYER */}
        <label htmlFor="addsalemodal-buyer-name" className="text-white/60 text-sm">Buyer Name</label>
        <input id="addsalemodal-buyer-name"
          type="text"
          value={buyer}
          onChange={(e) => setBuyer(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label htmlFor="addsalemodal-buyer-email-optional-needed-to-email-an-invoice" className="text-white/60 text-sm">Buyer Email (optional — needed to email an invoice)</label>
        <input id="addsalemodal-buyer-email-optional-needed-to-email-an-invoice"
          type="email"
          value={buyerEmail}
          onChange={(e) => setBuyerEmail(e.target.value)}
          placeholder="customer@example.com"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label htmlFor="addsalemodal-buyer-phone-optional" className="text-white/60 text-sm">Buyer Phone (optional)</label>
        <input id="addsalemodal-buyer-phone-optional"
          type="text"
          value={buyerPhone}
          onChange={(e) => setBuyerPhone(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label htmlFor="addsalemodal-buyer-address-optional" className="text-white/60 text-sm">Buyer Address (optional)</label>
        <textarea id="addsalemodal-buyer-address-optional"
          value={buyerAddress}
          onChange={(e) => setBuyerAddress(e.target.value)}
          rows={2}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {/* DATE */}
        <label htmlFor="addsalemodal-date" className="text-white/60 text-sm">Date</label>
        <input id="addsalemodal-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-6"
        />

        {/* What stopped the last Save, right beside the button: the field's own message
            can be screens above it in this scrolling form. */}
        {submitted && problems.length > 0 && (
          <p id="addsalemodal-save-error" role="status" className="text-red-400 text-sm mb-3 text-right">
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
                ? "bg-green-500 text-black hover:bg-green-400"
                : "bg-gray-600 text-gray-300 cursor-not-allowed"
            }`}
          >
            {existing ? "Update Sale" : "Save Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}