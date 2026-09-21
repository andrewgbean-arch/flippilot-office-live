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
