import { authHeaders } from "@/lib/authToken";
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

const EMPTY_DOC: BookkeepingDoc = {
  costs: [],
  purchases: [],
  sales: [],
  transactions: [],
  suppliers: [],
  categories: [],
};

// Was pure localStorage — a dealer's purchase/cost/sale records never
// left the one browser they were entered in, with no backup and
// nothing visible from a second device. Same shape as before, now
// backed by the real per-tenant backend (src/backend/src/routes/
// bookkeeping.ts) instead, same pattern as leadStorage.web.ts.
export async function loadBookkeeping(): Promise<BookkeepingDoc> {
  try {
    const res = await fetch(`${BASE_URL}/bookkeeping`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.ok) return EMPTY_DOC;
    return {
      costs: Array.isArray(data.costs) ? data.costs : [],
      purchases: Array.isArray(data.purchases) ? data.purchases : [],
      sales: Array.isArray(data.sales) ? data.sales : [],
      transactions: Array.isArray(data.transactions) ? data.transactions : [],
      suppliers: Array.isArray(data.suppliers) ? data.suppliers : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
    };
  } catch (err) {
    console.error("loadBookkeeping: backend unreachable", err);
    return EMPTY_DOC;
  }
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
