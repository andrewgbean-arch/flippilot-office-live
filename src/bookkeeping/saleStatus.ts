import type { SaleEntry } from "./types";

// Voided sales. A sale recorded by mistake (on the wrong car, or one that fell
// through) can't be deleted: its invoice number must never be reused and the
// record must stay. It is VOIDED instead: it keeps its figures and gains
// `voided`, and every figure (profit, income, VAT, sold counts) leaves it out.
// The backend does the same (saleVoids.ts), and refuses to let a save undo a void.

export function isVoided(sale: Pick<SaleEntry, "voided">): boolean {
  return typeof sale.voided === "object" && sale.voided !== null;
}

export function activeSales<T extends Pick<SaleEntry, "voided">>(sales: readonly T[]): T[] {
  return sales.filter((s) => !isVoided(s));
}
