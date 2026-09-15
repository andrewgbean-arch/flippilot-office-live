import { useBookkeeping } from "./BookkeepingProvider";

// Was hardcoded (BCA 18%, Copart 21%, Private Sellers 15% — the exact
// same three names and numbers regardless of any real purchase/cost
// data). Now aggregates real spend per source from purchases + costs.
// Dropped the "reliability" score entirely rather than fake it — there's
// no real signal to compute that from yet (would need outcome data like
// how flips from each source actually performed).
export default function SupplierPerformance() {
  const { purchases, costs } = useBookkeeping();

  const bySupplier: Record<string, { spend: number; count: number }> = {};

  const record = (supplier: string | undefined, amount: number) => {
    const name = supplier?.trim() || "Unknown";
    if (!bySupplier[name]) bySupplier[name] = { spend: 0, count: 0 };
    bySupplier[name].spend += amount;
    bySupplier[name].count += 1;
  };

  purchases.forEach(p => record(p.source, p.purchasePrice));
  costs.forEach(c => record(c.supplier, c.amount));

  const rows = Object.entries(bySupplier).sort((a, b) => b[1].spend - a[1].spend);

  return (
    <div className="bg-black/40 border border-white/10 p-6 rounded-xl shadow-xl">
      <h3 className="text-lg font-semibold text-white/80 mb-4">
        Purchase Sources
      </h3>

      {rows.length === 0 ? (
        <p className="text-white/50 text-sm">
          No purchases or costs recorded yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {rows.map(([name, stats]) => (
            <div
              key={name}
              className="bg-black/30 border border-white/10 p-4 rounded-lg"
            >
              <p className="text-white/80 font-semibold">{name}</p>
              <p className="text-yellow-300 text-sm">
                Total Spend: £{stats.spend.toLocaleString()}
              </p>
              <p className="text-white/60 text-sm">
                {stats.count} transaction{stats.count === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
