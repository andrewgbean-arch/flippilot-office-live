import { authHeaders } from "@/lib/authToken";
import { loadJson } from "@/lib/loadJson";
import type { CostEntry, PurchaseEntry, SaleEntry, TransactionEntry, Supplier, Category } from "./types";

import { BASE_URL } from "@/lib/apiBaseUrl";

export type BookkeepingDoc = {
  costs: CostEntry[];
  purchases: PurchaseEntry[];
  sales: SaleEntry[];
  transactions: TransactionEntry[];
  suppliers: Supplier[];
  categories: Category[];
};

// Was pure localStorage — a dealer's purchase/cost/sale records never
// left the one browser they were entered in, with no backup and
// nothing visible from a second device. Same shape as before, now
// backed by the real per-tenant backend (src/backend/src/routes/
// bookkeeping.ts) instead, same pattern as leadStorage.web.ts.
//
// null = the books couldn't be read (dropped connection, 401/402/403/5xx,
// a body that isn't a full ledger). This used to fall back to an empty
// ledger, and because every save writes the WHOLE document, the next
// ordinary "add a cost" after one failed load replaced the dealer's
// entire purchases/sales/costs/suppliers with just that one cost. The
// real backend always sends all six lists, so a body missing any of
// them is treated as unreadable rather than as "that list is empty".
export async function loadBookkeeping(): Promise<BookkeepingDoc | null> {
  const data = (await loadJson("/bookkeeping")) as
    | ({ ok?: boolean } & Partial<Record<keyof BookkeepingDoc, unknown>>)
    | null;
  if (!data?.ok) return null;

  const { costs, purchases, sales, transactions, suppliers, categories } = data;
  if (
    !Array.isArray(costs) ||
    !Array.isArray(purchases) ||
    !Array.isArray(sales) ||
    !Array.isArray(transactions) ||
    !Array.isArray(suppliers) ||
    !Array.isArray(categories)
  ) {
    return null;
  }
  return { costs, purchases, sales, transactions, suppliers, categories };
}

// Costs the screen deliberately deleted. The server MERGES every save into what it
// holds (backend bookkeepingMerge.ts), keeping entries this screen never saw (a
// colleague's), so a deletion has to be named to happen at all.
export type RemovedEntries = { costs?: string[] };

// Saves, and hands back the merged ledger the server now holds (null when the
// save failed or the reply isn't a whole ledger), so the screen can show entries
// someone else added since it loaded.
export async function saveBookkeeping(doc: BookkeepingDoc, removed?: RemovedEntries): Promise<BookkeepingDoc | null> {
  try {
    const res = await fetch(`${BASE_URL}/bookkeeping`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(removed ? { ...doc, removed } : doc),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<Record<keyof BookkeepingDoc, unknown>>;
    const lists = ["costs", "purchases", "sales", "transactions", "suppliers", "categories"] as const;
    if (!lists.every((k) => Array.isArray(data[k]))) return null;
    return data as BookkeepingDoc;
  } catch (err) {
    console.error("saveBookkeeping: backend unreachable", err);
    return null;
  }
}
