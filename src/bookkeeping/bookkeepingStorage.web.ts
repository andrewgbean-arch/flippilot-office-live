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

export async function saveBookkeeping(doc: BookkeepingDoc): Promise<void> {
  try {
    await fetch(`${BASE_URL}/bookkeeping`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(doc),
    });
  } catch (err) {
    console.error("saveBookkeeping: backend unreachable", err);
  }
}
