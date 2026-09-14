import type { SaleEntry } from "./types";

// Assigned once when a sale is first recorded and never recalculated —
// editing a sale must never renumber an invoice already issued to a
// customer (see updateSale in BookkeepingProvider, which merges a
// patch without touching invoiceNumber). Continues from the highest
// existing numeric suffix rather than sales.length + 1, which matters
// if a gap ever appears in the sequence (e.g. a legacy sale backfilled
// out of order). There is currently no way to delete a sale in this
// app at all — if one is ever added, deleting the single
// highest-numbered sale would let this reissue that same number, so
// that capability would need to either never delete the underlying
// row or carry forward a real persisted counter instead of deriving
// the next number from what's left in the array.
export function nextInvoiceNumber(sales: SaleEntry[]): string {
  let max = 0;
  for (const sale of sales) {
    const match = sale.invoiceNumber?.match(/(\d+)$/);
    if (match?.[1]) max = Math.max(max, parseInt(match[1], 10));
  }
  return `INV-${String(max + 1).padStart(4, "0")}`;
}
