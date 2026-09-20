import { formatMoney } from "@/lib/formatMoney";
import React, { useState, useMemo } from "react";
import { SaleEntry } from "./types";
import { calculateVat, calculateMarginVat } from "./vatUtils";
import { nextInvoiceNumber } from "./invoiceUtils";
import { useBookkeeping } from "./BookkeepingProvider";
import { useInventory } from "@/context/InventoryProvider";
import { toDateKey } from "@/planner/dateUtils";
import { readMoney } from "@/lib/parseMoney";
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
  const [vatRate, setVatRate] = useState<string>(existing ? String(existing.vatRate * 100) : "20");
  const [vatIncluded, setVatIncluded] = useState<boolean>(existing?.vatIncluded ?? true);
  const [buyer, setBuyer] = useState<string>(existing?.buyer ?? "");
  const [buyerEmail, setBuyerEmail] = useState<string>(existing?.buyerEmail ?? "");
  const [buyerPhone, setBuyerPhone] = useState<string>(existing?.buyerPhone ?? "");
  const [buyerAddress, setBuyerAddress] = useState<string>(existing?.buyerAddress ?? "");
  const [date, setDate] = useState<string>(existing?.date ?? toDateKey(new Date()));

  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const purchase = vehicleId ? getPurchaseForVehicle(vehicleId) : undefined;

  // Margin Scheme needs the vehicle's purchase price — if it doesn't
  // have one on record yet, there's nothing to compute a margin from,
  // so this falls back to standard VAT (same fallback BookkeepingProvider
  // applies), and the UI below says so rather than showing broken maths.
  const isMarginScheme = vehicle?.vatScheme === "margin" && !!purchase;

  // The sale price is REQUIRED and must be an amount above £0. A blank used to be
  // saved as a £0 sale (and the car marked SOLD at £0, printing "-Infinity%"), and
  // "£5,000" was read as nothing. Nothing is saved, and no car is marked sold,
  // until the price reads as a real amount.
  const [submitted, setSubmitted] = useState(false);
  const priceRead = readMoney(salePrice, { positive: true, blankMessage: "Enter the sale price." });
  const priceError = priceRead.ok ? null : priceRead.message;
  const showPriceError = priceError !== null && (submitted || salePrice.trim() !== "");
  // null while the price is blank or unreadable: the preview then shows dashes,
  // not a made-up £0 margin.
  const previewPrice = priceRead.ok ? priceRead.value : null;
  const numericVatRate = (Number(vatRate) || 0) / 100;

  const marginPreview = useMemo(() => {
    if (!isMarginScheme || !purchase || previewPrice === null) return null;
    return calculateMarginVat(previewPrice, purchase.purchasePrice, numericVatRate);
  }, [isMarginScheme, purchase, previewPrice, numericVatRate]);

  function handleSave() {
    if (!vehicleId) {
      alert("Select a vehicle first.");
      return;
    }
    if (!priceRead.ok) {
      setSubmitted(true);
      return;
    }
    const numericPrice = priceRead.value;

    let vatAmount: number;
    let netAmount: number;

    if (isMarginScheme && purchase) {
      const breakdown = calculateMarginVat(numericPrice, purchase.purchasePrice, numericVatRate);
      vatAmount = breakdown.vat;
      netAmount = numericPrice - breakdown.vat;
    } else {
      const breakdown = calculateVat(numericPrice, {
        vatRate: numericVatRate,
        vatIncluded,
        vatReclaimable: false,
      });
      vatAmount = breakdown.vat;
      netAmount = breakdown.net;
    }

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
        vatRate: numericVatRate,
        vatIncluded,
        ...contactFields,
      });
      onClose();
      return;
    }

    const entry: SaleEntry = {
      id: crypto.randomUUID(),
      vehicleId,
      salePrice: numericPrice,
      invoiceNumber: nextInvoiceNumber(sales),
      date,
      vatScheme: isMarginScheme ? "margin" : "standard",
      vatRate: numericVatRate,
      vatIncluded,
      vatAmount,
      netAmount,
      ...(isMarginScheme && purchase ? { marginPurchasePrice: purchase.purchasePrice } : {}),
      ...contactFields,
    };

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
              purchase ? (
                <span className="text-yellow-300/90">
                  VAT Margin Scheme — VAT is due on the profit margin only, not the sale price.
                </span>
              ) : (
                <span className="text-orange-300/90">
                  This vehicle is set to the Margin Scheme, but has no purchase price on
                  record yet — VAT will be calculated as standard VAT until it does.
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
          step="1"
          value={vatRate}
          onChange={(e) => setVatRate(e.target.value)}
          placeholder="20"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {isMarginScheme ? (
          /* MARGIN SCHEME BREAKDOWN — replaces "VAT Included?", which
             doesn't apply here: the sale price is just the sale price,
             margin VAT is a separately-calculated liability on top of
             the purchase/sale gap, not extracted from or added to it. */
          <div className="mb-4 px-3 py-3 rounded bg-black/40 border border-yellow-400/20 text-sm space-y-1">
            <div className="flex justify-between text-white/60">
              <span>Purchase Price</span>
              <span>{formatMoney(purchase!.purchasePrice, { pence: true })}</span>
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