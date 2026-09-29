// What counts as a RECORDED price in the dealership's books.
//
// The web app (lib/parseMoney.ts: isPositiveAmount) treats a purchase price or a sale
// price as recorded only when it is a finite number above zero. A blank that an older
// form saved as 0, a price that could not be read and was saved as nothing (NaN
// becomes null in JSON), text, or a negative is NOT a price, and the Bookkeeping hub
// then reports that car's profit as UNKNOWN and leaves it out.
//
// Pilot Brain reads the same ledger, and its per-car figures (vehicleMargins.ts) are
// documented as never contradicting the Bookkeeping screen. But it used to accept any
// finite number, so for a car whose purchase was saved as 0 the hub said "profit
// unknown" while Pilot Brain reported "bought £0, sold £5,000, profit £5,000 (100%)"
// and called it worked out exactly as the Bookkeeping screen does it.
//
// Every engine that works from a purchase price or a sale price reads it through this
// one function, so the two can never disagree about whether a price exists.
// (hubVsBrain.test.ts feeds one ledger to both and holds them to it.)
export function recordedPrice(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

// A SALE's recorded price, as the amount the customer paid: what the Bookkeeping
// screens call the sale price and work profit "before VAT on the sale" from.
//
// Every sale's salePrice already includes any VAT, except a Standard VAT sale saved
// with "price includes VAT: no" (VAT added ON TOP): its salePrice is the price
// before VAT and the customer paid that plus its vatAmount. Reading salePrice as it
// stands made such a sale show the VAT's worth less profit and revenue than the same
// sale saved with the VAT included. When that VAT isn't recorded, the paid amount is
// unknown (null), never guessed. The web app's saleVat.ts (salePricePaid) holds the
// same rule.
export function recordedSalePrice(sale: unknown): number | null {
  const s = (sale ?? {}) as { salePrice?: unknown; vatScheme?: unknown; vatIncluded?: unknown; vatAmount?: unknown };
  const price = recordedPrice(s.salePrice);
  if (price === null) return null;
  if (s.vatScheme !== "standard" || s.vatIncluded !== false) return price;
  const vat = s.vatAmount;
  return typeof vat === "number" && Number.isFinite(vat) && vat >= 0 ? price + vat : null;
}

// A sale's contribution to REVENUE totals: the amount paid, or, when that is
// unknown, the recorded price before VAT, or nothing. Revenue sums used to add
// salePrice as it stood, including a NaN or negative from a bad save.
export function saleRevenue(sale: unknown): number {
  return recordedSalePrice(sale) ?? recordedPrice((sale as { salePrice?: unknown } | null)?.salePrice) ?? 0;
}
