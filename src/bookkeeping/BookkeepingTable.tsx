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

  // Build dynamic ledger from provider data
  const ledger = purchases.map((p) => {
    const sale = sales.find((s) => s.vehicleId === p.vehicleId);
    const totalCost = getTotalCostForVehicle(p.vehicleId);
    const profitSummary = getProfitForVehicle(p.vehicleId);
    const vehicle = vehicles.find((v) => v.id === p.vehicleId);

    return {
      id: p.vehicleId,
      vehicle: vehicle ? `${vehicle.make} ${vehicle.model}` : "Unknown vehicle",
      purchase: p.purchasePrice,
      totalCost,
      expectedSale: sale?.salePrice ?? 0,
      profit: profitSummary?.profit ?? 0,
      margin: profitSummary?.margin ?? 0,
      supplier: p.supplier ?? "Unknown",
      date: p.date,
      vatDue: sale?.vatAmount,
      vatScheme: sale?.vatScheme,
    };
  });

  return (
    <div className="bg-black/40 border border-white/10 rounded-xl shadow-xl overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white/80">
          Acquisition Ledger — {vehicleId ? `Vehicle ID: ${vehicleId}` : "All Vehicles"}
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
            <th className="p-3 text-left">Supplier</th>
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
              <td className="p-3">£{row.purchase.toLocaleString()}</td>
              <td className="p-3">£{row.totalCost.toLocaleString()}</td>
              <td className="p-3">£{row.expectedSale.toLocaleString()}</td>
              <td className="p-3 text-green-300">£{row.profit.toLocaleString()}</td>
              <td className="p-3">{row.margin.toFixed(1)}%</td>
              <td className="p-3">
                {row.vatDue != null ? (
                  <>
                    £{row.vatDue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
              <td className="p-3">{row.supplier}</td>
              <td className="p-3">{row.date}</td>
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
