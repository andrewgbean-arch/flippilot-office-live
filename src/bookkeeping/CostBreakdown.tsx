import { useBookkeeping } from "./BookkeepingProvider";
import type { CostType } from "./types";

const LABELS: Record<CostType, string> = {
  purchase: "Purchase",
  transport: "Transport",
  auction: "Auction Fees",
  parts: "Parts",
  labour: "Labour",
  mot: "MOT",
  tyres: "Tyres",
  detailing: "Detailing",
  advertising: "Advertising",
  misc: "Misc",
  recon: "Recon",
};

const COLORS: Record<string, string> = {
  purchase: "text-yellow-300",
  transport: "text-purple-300",
  auction: "text-yellow-300",
  parts: "text-blue-300",
  labour: "text-orange-300",
  mot: "text-green-300",
  tyres: "text-pink-300",
  detailing: "text-cyan-300",
  advertising: "text-red-300",
  misc: "text-white/70",
  recon: "text-red-300",
};

// Was hardcoded (Repairs £4,200, Parts £1,850...) regardless of what was
// actually recorded — now aggregates real cost entries by type.
export default function CostBreakdown() {
  const { costs } = useBookkeeping();

  const totals = costs.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] ?? 0) + c.amount;
    return acc;
  }, {} as Record<string, number>);

  const rows = Object.entries(totals);

  return (
    <div className="bg-black/40 border border-white/10 p-6 rounded-xl shadow-xl">
      <h3 className="text-lg font-semibold text-white/80 mb-4">
        Cost Breakdown
      </h3>

      {rows.length === 0 ? (
        <p className="text-white/50 text-sm">No costs recorded yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {rows.map(([type, amount]) => (
            <div
              key={type}
              className="bg-black/30 border border-white/10 p-4 rounded-lg"
            >
              <p className="text-white/80">{LABELS[type as CostType] ?? type}</p>
              <p className={`${COLORS[type] ?? "text-white"} text-xl font-bold`}>
                £{amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
