// What a cost REALLY costs the dealership, for working out a car's profit.
//
// A cost is saved with the amount as typed plus its VAT split (vatAmount, netAmount) and
// whether that VAT can be claimed back (vatReclaimable). VAT a dealer can reclaim is not a
// cost to them, so a £480 tyre bill with £80 reclaimable VAT costs £400. VAT they can NOT
// reclaim is part of the cost, so the same bill for a dealer who is not VAT-registered
// costs the full £480, and a bill typed as £400 "+ VAT" costs £480 rather than £400.
//
// The car's Profit tab always did it this way; the Bookkeeping hub, the ledger and Pilot
// Brain added up the amounts as typed, so one car showed two different profits.
// Everything that works out a car's profit now reads its costs through this one function.
// (A copy lives in src/backend/src/engines/costBasis.ts for the server; costBasisParity
// holds the two to the same answers.)
//
// "Total spend" and "spend by supplier" are deliberately NOT this: they are money paid out,
// which is the amount as typed.
//
// Returns null when the amount itself is not a real number, so the caller can say the
// profit is unknown rather than counting it as nothing. A record from before VAT was split
// out (no net/vat/reclaimable) is read as typed.
export function costValue(cost: unknown): number | null {
  const c = (cost ?? {}) as { amount?: unknown; netAmount?: unknown; vatAmount?: unknown; vatReclaimable?: unknown };
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (!finite(c.amount)) return null;
  if (!finite(c.netAmount) || !finite(c.vatAmount) || typeof c.vatReclaimable !== "boolean") return c.amount;
  return c.netAmount + (c.vatReclaimable ? 0 : c.vatAmount);
}
