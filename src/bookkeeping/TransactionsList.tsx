import { useBookkeeping } from "./BookkeepingProvider";
import { formatMoney } from "@/lib/formatMoney";
import { formatDate } from "@/dealer/inventory/vehicleListModel";

// "Other income and expenses": what Add Transaction records (rent, insurance,
// a warranty payment...). They were saved but no screen showed them. Newest
// first, with what came in and went out in total. Not part of any car's
// profit: they belong to the business, not to a car.
export default function TransactionsList() {
  const { transactions } = useBookkeeping();
  const sorted = [...transactions].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const moneyIn = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + (Number.isFinite(t.amount) ? t.amount : 0), 0);
  const moneyOut = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + (Number.isFinite(t.amount) ? t.amount : 0), 0);

  return (
    <section aria-labelledby="other-transactions-heading" className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-black/40 p-5">
      <h2 id="other-transactions-heading" className="text-lg font-bold text-yellow-300">
        Other income and expenses
      </h2>
      <p className="mb-4 text-sm text-white/60">
        Everything recorded with Add Transaction, such as rent or insurance. These belong to the business, so they're not
        in any car's profit.
      </p>

      {sorted.length === 0 ? (
        <p className="text-sm text-white/60">Nothing recorded yet. Use Add Transaction for anything that isn't a car.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <span className="text-green-300">In: {formatMoney(moneyIn, { pence: "auto" })}</span>
            <span className="text-red-300">Out: {formatMoney(moneyOut, { pence: "auto" })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-white/50">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Category</th>
                  <th className="py-2 pr-3 font-semibold">Notes</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => (
                  <tr key={t.id} className="border-t border-white/10">
                    <td className="py-2 pr-3 text-white/80">{formatDate(t.date) ?? t.date}</td>
                    <td className="py-2 pr-3 text-white">{t.category || "Uncategorised"}</td>
                    <td className="py-2 pr-3 text-white/70">{t.notes || ""}</td>
                    <td className={`py-2 text-right font-semibold ${t.type === "income" ? "text-green-300" : "text-red-300"}`}>
                      {t.type === "income" ? "+" : "-"}
                      {formatMoney(t.amount, { pence: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
