// One-time backfill: SaleEntry gained a required `invoiceNumber` field
// for the new invoicing feature, but real sales recorded before that
// change have none. Assigns sequential INV-0001-style numbers to any
// sale missing one, ordered by sale date, continuing from the highest
// existing numeric suffix in that dealership so a re-run (or a mix of
// old and already-numbered sales) never reuses or reassigns a number.
// Safe to re-run — only sales with no invoiceNumber are touched. Run
// with:
//   npx tsx scripts/backfillInvoiceNumbers.ts
import { readCollection, readTenantDoc, writeTenantDoc } from "../src/db";

interface SaleEntryLike {
  id: string;
  invoiceNumber?: string;
  date: string;
  [key: string]: unknown;
}

interface BookkeepingDocLike {
  sales: SaleEntryLike[];
  [key: string]: unknown;
}

const dealerships = readCollection<{ id: string }>("dealerships");
console.log(`Checking ${dealerships.length} dealership(s) for sales missing an invoice number...`);

for (const dealership of dealerships) {
  const doc = readTenantDoc<BookkeepingDocLike>(dealership.id, "bookkeeping", { sales: [] });
  if (!Array.isArray(doc.sales) || doc.sales.length === 0) continue;

  const missing = doc.sales.filter(s => !s.invoiceNumber);
  if (missing.length === 0) continue;

  let max = 0;
  for (const sale of doc.sales) {
    const match = sale.invoiceNumber?.match(/(\d+)$/);
    if (match?.[1]) max = Math.max(max, parseInt(match[1], 10));
  }

  for (const sale of [...missing].sort((a, b) => a.date.localeCompare(b.date))) {
    max += 1;
    sale.invoiceNumber = `INV-${String(max).padStart(4, "0")}`;
  }

  writeTenantDoc(dealership.id, "bookkeeping", doc);
  console.log(`  Dealership ${dealership.id}: backfilled ${missing.length} invoice number(s)`);
}

console.log("Done.");
