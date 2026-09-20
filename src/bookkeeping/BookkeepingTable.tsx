import { formatMoney } from "@/lib/formatMoney";
import { formatDate } from "@/dealer/inventory/vehicleListModel";
import { FiChevronRight } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useBookkeeping } from "./BookkeepingProvider";
import { useInventory } from "@/context/InventoryProvider";

export interface BookkeepingTableProps {
  vehicleId?: string;
}

export default function BookkeepingTable({ vehicleId }: BookkeepingTableProps) {
  const navigate = useNavigate();
  const {
    purchases,
    sales,
    getTotalCostForVehicle,
    getProfitForVehicle,
  } = useBookkeeping();
  const { vehicles } = useInventory();

  // Build dynamic ledger from provider data — scoped to vehicleId when
  // given. Previously this prop was only used in the header text
  // ("Vehicle ID: X"), while the table body below it still mapped over
  // EVERY purchase regardless, so CostsTab.tsx (the real "Costs" tab on
  // a vehicle's own overview page) showed every other vehicle's
  // purchase/cost/profit rows mixed in under a header claiming to be
  // scoped to just the one vehicle being viewed.
  const scopedPurchases = vehicleId
    ? purchases.filter((p) => p.vehicleId === vehicleId)
    : purchases;

  const ledger = scopedPurchases.map((p) => {
    const sale = sales.find((s) => s.vehicleId === p.vehicleId);
    const totalCost = getTotalCostForVehicle(p.vehicleId);
    const profitSummary = getProfitForVehicle(p.vehicleId);
    const vehicle = vehicles.find((v) => v.id === p.vehicleId);

    return {
      id: p.vehicleId,
      vehicle: vehicle ? `${vehicle.make} ${vehicle.model}` : "Unknown vehicle",
      purchase: p.purchasePrice,
      totalCost,
      // Not sold yet (or sold with no purchase on record) means UNKNOWN, not zero:
      // the ledger used to print "Sale £0, Profit £0, Margin 0.0%" for a car that
      // simply hasn't sold, which reads as a car sold for nothing.
      expectedSale: sale?.salePrice ?? null,
      profit: profitSummary?.profit ?? null,
      margin: profitSummary?.margin ?? null,
      source: p.source ?? "Unknown",
      date: p.date,
      vatDue: sale?.vatAmount,
      vatScheme: sale?.vatScheme,
    };
  });

  return (
    <div className="bg-black/40 border border-white/10 rounded-xl shadow-xl overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white/80">
          Acquisition Ledger — {vehicleId ? (ledger[0]?.vehicle ?? "This vehicle") : "All Vehicles"}
        </h3>
      </div>

      <table className="w-full text-sm text-white/80">
        <thead className="bg-black/30 text-white/60">
          <tr>
            <th className="p-3 text-left">Vehicle</th>
            <th className="p-3 text-left">Purchase</th>
            <th className="p-3 text-left">Total Cost</th>
            <th className="p-3 text-left">Sale</th>
            <th className="p-3 text-left">Profit</th>
            <th className="p-3 text-left">Margin</th>
            <th className="p-3 text-left">VAT Due</th>
            <th className="p-3 text-left">Purchased From</th>
            <th className="p-3 text-left">Date</th>
            <th className="p-3"></th>
          </tr>
        </thead>

        <tbody>
          {ledger.map((row) => (
            <tr
              key={row.id}
              onClick={() => navigate(`/bookkeeping/entry/${row.id}`)}
              className="border-t border-white/10 hover:bg-white/5 transition cursor-pointer"
            >
              <td className="p-3">{row.vehicle}</td>
              <td className="p-3">{formatMoney(row.purchase)}</td>
              <td className="p-3">{formatMoney(row.totalCost)}</td>
              <td className="p-3">{formatMoney(row.expectedSale)}</td>
              <td className={`p-3 ${row.profit === null ? "text-white/60" : row.profit < 0 ? "text-red-300" : "text-green-300"}`}>{formatMoney(row.profit)}</td>
              <td className="p-3">{row.margin === null ? "—" : `${row.margin.toFixed(1)}%`}</td>
              <td className="p-3">
                {row.vatDue != null ? (
                  <>
                    {formatMoney(row.vatDue, { pence: true })}
                    <span
                      className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                        row.vatScheme === "margin"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : "bg-blue-500/20 text-blue-300"
                      }`}
                    >
                      {row.vatScheme === "margin" ? "Margin" : "Standard"}
                    </span>
                  </>
                ) : (
                  <span className="text-white/30">—</span>
                )}
              </td>
              <td className="p-3">{row.source}</td>
              <td className="p-3">{formatDate(row.date) ?? row.date}</td>
              <td className="p-3">
                <FiChevronRight className="text-white/40 hover:text-yellow-300 transition" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
