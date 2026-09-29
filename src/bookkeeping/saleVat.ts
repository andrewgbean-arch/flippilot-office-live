import type { PurchaseEntry, SaleEntry } from "./types";
import { calculateVat, marginVatForSale } from "./vatUtils";
import { isPositiveAmount, isValidVatRate } from "@/lib/parseMoney";

// The ONE place a recorded sale gets its VAT and net figures, used by the Record
// Sale form's preview and save, by addSale and updateSale, and by recording a
// purchase price later.
//
// A figure that cannot be worked out is stored as null ("not worked out"), never as
// a number made up to fill the gap:
//
//   Margin scheme, real purchase price -> margin VAT (a sixth of the margin at 20%).
//   Margin scheme, NO real purchase price (none on record, or one saved as 0 / nothing
//     / text / a negative) -> no VAT figure. It used to be worked out as if the car had
//     cost £0 (a £6,000 sale stored £1,000 of VAT instead of the £166.67 a £5,000
//     purchase would give), and before that it silently switched the sale to standard
//     VAT. The sale stays a Margin Scheme sale (that is the scheme the car is in, and
//     its invoice must show no VAT); the VAT due is filled in when the purchase price
//     is recorded.
//   Standard scheme -> VAT on the price, unless the price or the rate is unusable.
export function withSaleVat(sale: SaleEntry, purchase: Pick<PurchaseEntry, "purchasePrice"> | undefined): SaleEntry {
  // Whatever the sale said about a purchase before is dropped: it is either put back
  // (from the purchase now on record) or it no longer applies.
  const { marginPurchasePrice: _previous, ...base } = sale;

  if (sale.vatScheme === "margin") {
    const purchasePrice = purchase?.purchasePrice;
    const margin = marginVatForSale(sale.salePrice, purchasePrice, sale.vatRate);
    if (margin && isPositiveAmount(purchasePrice)) {
      return {
        ...base,
        vatScheme: "margin",
        vatAmount: margin.vat,
        netAmount: sale.salePrice - margin.vat,
        marginPurchasePrice: purchasePrice,
      };
    }
    return { ...base, vatScheme: "margin", vatAmount: null, netAmount: null };
  }

  if (typeof sale.salePrice === "number" && Number.isFinite(sale.salePrice) && isValidVatRate(sale.vatRate)) {
    const vat = calculateVat(sale.salePrice, { vatRate: sale.vatRate, vatIncluded: sale.vatIncluded, vatReclaimable: false });
    return { ...base, vatScheme: "standard", vatAmount: vat.vat, netAmount: vat.net };
  }
  return { ...base, vatScheme: "standard", vatAmount: null, netAmount: null };
}

// The VAT and net of a STORED sale, as far as they can be trusted. A sale saved
// before this rule can hold a VAT figure that was never real: margin VAT worked from
// a purchase price of 0, or VAT on a price that is itself not recorded. Showing that
// next to a profit of "—" contradicts itself, so it reads as not worked out (null).
export function trustedSaleVat(sale: Pick<SaleEntry, "vatScheme" | "salePrice" | "vatAmount" | "netAmount" | "marginPurchasePrice">): {
  vat: number | null;
  net: number | null;
} {
  const none = { vat: null, net: null };
  if (!isPositiveAmount(sale.salePrice)) return none;
  if (sale.vatScheme === "margin" && !isPositiveAmount(sale.marginPurchasePrice)) return none;
  const vat = typeof sale.vatAmount === "number" && Number.isFinite(sale.vatAmount) ? sale.vatAmount : null;
  const net = typeof sale.netAmount === "number" && Number.isFinite(sale.netAmount) ? sale.netAmount : null;
  return { vat, net };
}

// What the customer actually paid for a sale. With VAT added ON TOP of the price
// (a Standard VAT sale saved with "price includes VAT: no"), the stored salePrice
// is the price BEFORE VAT, and the car's page used to show that as the "Sale Price",
// never the amount the customer paid. Every other sale's price already includes
// any VAT. `vat` is the sale's trusted VAT (trustedSaleVat), or null when it is not
// worked out, in which case the paid amount is unknown rather than guessed.
export function salePricePaid(
  sale: Pick<SaleEntry, "salePrice" | "vatScheme" | "vatIncluded">,
  vat: number | null
): { paid: number | null; beforeVat: number | null; vatOnTop: boolean } {
  const price = isPositiveAmount(sale.salePrice) ? sale.salePrice : null;
  const vatOnTop = sale.vatScheme === "standard" && sale.vatIncluded === false;
  if (!vatOnTop) return { paid: price, beforeVat: null, vatOnTop: false };
  return { paid: price !== null && vat !== null ? price + vat : null, beforeVat: price, vatOnTop: true };
}

// The sale price that profit and revenue are worked from: what the customer paid
// (salePricePaid above), or null when that isn't a real amount. Profit is shown
// "before VAT on the sale"; a VAT-on-top sale read as its stored price showed the
// VAT's worth less profit than the same sale saved with the VAT included. The
// backend's engines/recordedPrice.ts (recordedSalePrice) holds the same rule.
export function salePaidAmount(sale: SaleEntry): number | null {
  return salePricePaid(sale, trustedSaleVat(sale).vat).paid;
}

// A sale's share of an income total: the amount paid, or when that is unknown the
// recorded price before VAT, or nothing.
export function saleIncome(sale: SaleEntry): number {
  return salePaidAmount(sale) ?? (isPositiveAmount(sale.salePrice) ? sale.salePrice : 0);
}
