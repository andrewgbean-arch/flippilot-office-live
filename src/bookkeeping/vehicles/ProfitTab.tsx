import React from "react";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { useInventory } from "@/context/InventoryProvider";
import { formatPrice } from "@/dealer/inventory/vehicleListModel";
import { profitBeforeSaleVat, riskCheck } from "./profitFigures";

// A price of 0 or none at all means "not set" (see profitFigures.ts); the
// caller passes null rather than a 0 that would read as "it cost nothing".
interface ProfitTabProps {
  vehicleId: string;
  purchasePrice: number | null;
  expectedSale: number | null;
}

export default function ProfitTab({
  vehicleId,
  purchasePrice,
  expectedSale,
}: ProfitTabProps) {
  const { getCostsForVehicle } = useBookkeeping();
  const { vehicles } = useInventory();

  const costs = getCostsForVehicle(vehicleId) ?? [];
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  const totalNet = costs.reduce((sum, c) => sum + c.netAmount, 0);

  // VAT logic:
  // reclaimable VAT = 0 (because reclaimable VAT does NOT increase cost)
  // non‑reclaimable VAT = added to cost
  const totalVat = costs.reduce(
    (sum, c) => sum + (c.vatReclaimable ? 0 : c.vatAmount),
    0
  );

  const totalGross = totalNet + totalVat;

  // Was "Real Profit". It leaves out any VAT due on the sale itself (a sixth
  // of the margin under the margin scheme), so on a margin-scheme car it
  // overstated what the dealer keeps; it is now named for what it is.
  const profit = profitBeforeSaleVat({
    purchasePrice,
    expectedSale,
    grossCosts: totalGross,
  });

  // This tab also used to show "Flip Difficulty" and "Valuation Confidence".
  // Both were worked out from a market-heat and risk figure that were 0 on
  // every car, so flip difficulty read "High" for almost any used car and
  // valuation confidence FELL as the dealer's margin rose. They were removed
  // rather than replaced: there is no honest input to compute them from.
  const risk = riskCheck(vehicle);

  return (
    <div className="p-6 space-y-6">

      {/* HEADER */}
      <h2 className="text-xl font-semibold text-white/80">
        Profit Analysis
      </h2>

      {/* SUMMARY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* PURCHASE */}
        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <h3 className="text-white/60 text-sm">Purchase Price</h3>
          <p className="text-white text-2xl font-bold">
            {formatPrice(purchasePrice) ?? "Not set"}
          </p>
        </div>

        {/* EXPECTED SALE */}
        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <h3 className="text-white/60 text-sm">Expected Sale Price</h3>
          <p className="text-green-300 text-2xl font-bold">
            {formatPrice(expectedSale) ?? "Not set"}
          </p>
        </div>

        {/* TOTAL NET COST */}
        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <h3 className="text-white/60 text-sm">Net Cost (ex VAT)</h3>
          <p className="text-white text-2xl font-bold">
            £{totalNet.toLocaleString()}
          </p>
        </div>

        {/* TOTAL VAT */}
        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <h3 className="text-white/60 text-sm">VAT (non‑reclaimable)</h3>
          <p className="text-yellow-300 text-2xl font-bold">
            £{totalVat.toLocaleString()}
          </p>
        </div>

        {/* TOTAL GROSS COST */}
        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <h3 className="text-white/60 text-sm">Total Cost (gross)</h3>
          <p className="text-white text-2xl font-bold">
            £{totalGross.toLocaleString()}
          </p>
        </div>

        {/* PROFIT BEFORE VAT ON THE SALE */}
        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <h3 className="text-white/60 text-sm">Profit before VAT on the sale</h3>
          {profit === null ? (
            <>
              <p className="text-white/60 text-2xl font-bold">Not worked out</p>
              <p className="text-white/50 text-xs mt-1">
                Set a purchase price and an asking price on the Edit tab to see this.
              </p>
            </>
          ) : (
            <>
              <p
                className={`text-2xl font-bold ${
                  profit >= 0 ? "text-green-300" : "text-red-400"
                }`}
              >
                {profit < 0 ? "-" : ""}£{Math.abs(profit).toLocaleString()}
              </p>
              <p className="text-white/50 text-xs mt-1">
                Sale price less the purchase price and all costs above. Any VAT
                due on the sale (for example under the margin scheme) is not
                taken off here.
              </p>
            </>
          )}
        </div>
      </div>

      {/* RULE-OF-THUMB RISK */}
      <div className="bg-black/40 border border-white/10 p-4 rounded-xl space-y-2">
        <h3 className="text-white/80 text-lg font-semibold">Risk check</h3>

        <div className="flex justify-between text-white/70">
          <span>Rule-of-thumb risk</span>
          <span className="font-semibold">{risk}</span>
        </div>

        <p className="text-white/50 text-xs">
          Adds up points for high mileage, MOT advisories, recorded MOT
          failures and the age of the car. It is a rough guide, not a
          prediction or a valuation.
        </p>
      </div>
    </div>
  );
}
