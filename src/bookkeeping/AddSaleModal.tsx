import React, { useState, useMemo } from "react";
import { SaleEntry } from "./types";
import { calculateVat, calculateMarginVat } from "./vatUtils";
import { useBookkeeping } from "./BookkeepingProvider";
import { useInventory } from "@/context/InventoryProvider";
import VehiclePicker from "./VehiclePicker";

interface AddSaleModalProps {
  vehicleId: string | null;
  onClose: () => void;
}

export default function AddSaleModal({ vehicleId: initialVehicleId, onClose }: AddSaleModalProps) {
  const { addSale, getPurchaseForVehicle } = useBookkeeping();
  const { vehicles, updateVehicleSale } = useInventory();

  // Was a fixed prop with no way to change it — now an editable
  // selection, defaulting to whatever the caller suggested.
  const [vehicleId, setVehicleId] = useState<string | null>(initialVehicleId);
  const [salePrice, setSalePrice] = useState<string>("");
  const [vatRate, setVatRate] = useState<string>("20");
  const [vatIncluded, setVatIncluded] = useState<boolean>(true);
  const [buyer, setBuyer] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const purchase = vehicleId ? getPurchaseForVehicle(vehicleId) : undefined;

  // Margin Scheme needs the vehicle's purchase price — if it doesn't
  // have one on record yet, there's nothing to compute a margin from,
  // so this falls back to standard VAT (same fallback BookkeepingProvider
  // applies), and the UI below says so rather than showing broken maths.
  const isMarginScheme = vehicle?.vatScheme === "margin" && !!purchase;

  const numericPrice = Number(salePrice) || 0;
  const numericVatRate = (Number(vatRate) || 0) / 100;

  const marginPreview = useMemo(() => {
    if (!isMarginScheme || !purchase) return null;
    return calculateMarginVat(numericPrice, purchase.purchasePrice, numericVatRate);
  }, [isMarginScheme, purchase, numericPrice, numericVatRate]);

  function handleSave() {
    if (!vehicleId) {
      alert("Select a vehicle first.");
      return;
    }

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

    const entry: SaleEntry = {
      id: crypto.randomUUID(),
      vehicleId,
      salePrice: numericPrice,
      buyer,
      date,
      vatScheme: isMarginScheme ? "margin" : "standard",
      vatRate: numericVatRate,
      vatIncluded,
      vatAmount,
      netAmount,
      ...(isMarginScheme && purchase ? { marginPurchasePrice: purchase.purchasePrice } : {}),
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
        <label className="text-white/60 text-sm">VAT Rate (%)</label>
        <input
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
              <span>£{purchase!.purchasePrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Margin</span>
              <span>£{(marginPreview?.margin ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-yellow-300 font-semibold pt-1 border-t border-white/10 mt-1">
              <span>VAT Due (Margin Scheme)</span>
              <span>£{(marginPreview?.vat ?? 0).toFixed(2)}</span>
            </div>
          </div>
        ) : (
          /* VAT INCLUDED */
          <>
            <label className="text-white/60 text-sm">VAT Included?</label>
            <select
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