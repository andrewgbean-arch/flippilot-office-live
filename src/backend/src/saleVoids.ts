// Voided sales. A sale recorded by mistake (on the wrong car, or one that fell
// through) can't be deleted: its invoice number must never be reused and the
// record must stay. Instead it is VOIDED: it keeps its figures and gains
// `voided: { at, reason, byName }`, and every figure (profit, revenue, VAT, sales
// counts) leaves it out. The web app does the same (bookkeeping/saleStatus.ts).

type Rec = Record<string, unknown>;

export function isVoidedSale(sale: unknown): boolean {
  const v = (sale as { voided?: unknown } | null)?.voided;
  return typeof v === "object" && v !== null;
}

/** The ledger as the figures see it: the same doc with voided sales left out. */
export function withoutVoidedSales<T>(doc: T): T {
  if (typeof doc !== "object" || doc === null) return doc;
  const sales = (doc as { sales?: unknown }).sales;
  if (!Array.isArray(sales)) return doc;
  return { ...doc, sales: sales.filter((s) => !isVoidedSale(s)) };
}

// A whole-ledger save from an out-of-date screen must not un-void a sale, change a
// voided sale's figures or drop it: voiding is one way. Every sale voided in the
// stored ledger is put back exactly as stored, in its place if the save still has
// it, or at the end if the save left it out.
export function keepVoidedSales(stored: unknown, incoming: Rec[]): Rec[] {
  const before = Array.isArray(stored) ? (stored as unknown[]) : [];
  const voided = new Map<string, Rec>();
  for (const s of before) {
    const id = (s as { id?: unknown } | null)?.id;
    if (isVoidedSale(s) && typeof id === "string") voided.set(id, s as Rec);
  }
  if (voided.size === 0) return incoming;
  const seen = new Set<string>();
  const out = incoming.map((s) => {
    const id = typeof s.id === "string" ? s.id : null;
    if (id && voided.has(id)) {
      seen.add(id);
      return voided.get(id)!;
    }
    return s;
  });
  for (const [id, s] of voided) if (!seen.has(id)) out.push(s);
  return out;
}
