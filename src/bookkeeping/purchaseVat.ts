import type { PurchaseEntry } from "./types";

// A car bought under the VAT Margin Scheme (private seller, trade-in, most used
// cars) comes with NO VAT invoice, so its purchase carries no VAT at all: there
// is none to reclaim and none to show. The purchase forms used to default to the
// Margin Scheme AND to "20% VAT included", so a 6,000 margin purchase was saved
// with 1,000 of VAT that never existed. It then showed in the vehicle ledger,
// on the supplier pages ("VAT Impact") and in the purchases CSV, where an
// accountant could take it for input VAT to claim.

export type PurchaseScheme = "margin" | "standard";

// The VAT settings a purchase must be SAVED with for the scheme chosen. The
// provider works out VAT and net from these, so they have to be right before
// saving: under the margin scheme the rate is 0 and the price is not "VAT
// included", whatever was left in the rate box.
export function purchaseVatSettings(
  scheme: PurchaseScheme,
  typedRate: number,
  typedIncluded: boolean
): { vatRate: number; vatIncluded: boolean } {
  if (scheme === "margin") return { vatRate: 0, vatIncluded: false };
  return { vatRate: typedRate, vatIncluded: typedIncluded };
}

// Purchases saved BEFORE the fix carry phantom VAT and no scheme of their own.
// The scheme lives on the car, so this looks it up there. It is applied in
// memory when the books are shown or exported; it never rewrites what is
// stored, so nothing is lost if a car's scheme is later corrected.
//
// Idempotent: a purchase that is already right comes back as the SAME object, and
// running it twice gives the same result as running it once.
export function normalisePurchaseVat(purchase: PurchaseEntry, vehicleScheme?: string | null): PurchaseEntry {
  const scheme = purchase.vatScheme ?? (vehicleScheme === "margin" || vehicleScheme === "standard" ? vehicleScheme : undefined);
  if (scheme !== "margin") return purchase;

  const alreadyRight =
    purchase.vatScheme === "margin" &&
    purchase.vatRate === 0 &&
    purchase.vatIncluded === false &&
    purchase.vatAmount === 0 &&
    purchase.netAmount === purchase.purchasePrice;
  if (alreadyRight) return purchase;

  return {
    ...purchase,
    vatScheme: "margin",
    vatRate: 0,
    vatIncluded: false,
    vatAmount: 0,
    netAmount: purchase.purchasePrice,
  };
}

export function normalisePurchases(
  purchases: readonly PurchaseEntry[],
  vehicles: readonly { id: string; vatScheme?: string | null }[]
): PurchaseEntry[] {
  const schemeById = new Map<string, string | null | undefined>();
  for (const v of vehicles) schemeById.set(v.id, v.vatScheme);
  return purchases.map((p) => normalisePurchaseVat(p, schemeById.get(p.vehicleId)));
}

// True when this purchase was made under the margin scheme (so no VAT is shown).
export function isMarginPurchase(purchase: PurchaseEntry): boolean {
  return purchase.vatScheme === "margin";
}
