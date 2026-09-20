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

// What an invoice for a recorded sale must say. ONE definition, used by BOTH
// the printed page and the email body (Invoice.tsx), so the two can never
// disagree about what the customer owes.
//
// How a sale is stored (see AddSaleModal + addSale/updateSale in
// BookkeepingProvider) is the whole reason this exists, because "sale price" does
// NOT always mean "what the customer pays":
//
//   Margin scheme          salePrice = what the customer pays. Any VAT is the
//                          dealer's own liability on the margin, inside that
//                          price. Notice 718: the invoice shows NO VAT at all.
//   Standard, VAT included salePrice = the gross the customer pays (net + VAT).
//   Standard, VAT on top   salePrice = the NET price typed in. The customer
//                          pays that PLUS the VAT. Printing salePrice as the
//                          total left it short by the VAT (a 1,000 + 20% sale
//                          asked for 1,000, not 1,200).
//   No VAT (rate 0)        standard with a 0% rate: net = gross, VAT 0.
//
// Everything is worked in whole pence so the printed lines always add up:
// the VAT line is the VAT rounded to the nearest penny (half a penny rounds up)
// and the net line is what is left, so Net + VAT is exactly the total.
export interface InvoiceVatLines {
  net: number;
  vat: number;
  // 20 for 20%, for the "VAT (20%)" label.
  ratePercent: number;
}

export interface InvoiceFigures {
  scheme: "margin" | "standard";
  // What the customer pays, in pounds and pence. null when the sale has no
  // usable price (blank saved as 0, or unreadable): there is nothing honest to bill.
  totalDue: number | null;
  // The amount printed on the vehicle's own line: the price as it was typed.
  itemAmount: number | null;
  // The Net and VAT lines to print. null under the margin scheme (never show VAT)
  // and when there is no usable price.
  vatLines: InvoiceVatLines | null;
}

type InvoiceSale = Pick<SaleEntry, "vatScheme" | "salePrice" | "vatRate" | "vatIncluded">;

const toPence = (pounds: number): number => Math.round(pounds * 100);
const toPounds = (pence: number): number => pence / 100;

export function invoiceFigures(sale: InvoiceSale): InvoiceFigures {
  const scheme = sale.vatScheme === "margin" ? "margin" : "standard";
  const none: InvoiceFigures = { scheme, totalDue: null, itemAmount: null, vatLines: null };

  const price = sale.salePrice;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return none;
  const pricePence = toPence(price);

  if (scheme === "margin") {
    return { scheme, totalDue: toPounds(pricePence), itemAmount: toPounds(pricePence), vatLines: null };
  }

  const rate = sale.vatRate;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 1) return none;
  // Basis points (2000 = 20%), so the pence sums below stay in exact integers.
  const basisPoints = Math.round(rate * 10000);

  if (sale.vatIncluded) {
    const vatPence = Math.round((pricePence * basisPoints) / (10000 + basisPoints));
    return {
      scheme,
      totalDue: toPounds(pricePence),
      itemAmount: toPounds(pricePence),
      vatLines: { net: toPounds(pricePence - vatPence), vat: toPounds(vatPence), ratePercent: basisPoints / 100 },
    };
  }

  const vatPence = Math.round((pricePence * basisPoints) / 10000);
  return {
    scheme,
    totalDue: toPounds(pricePence + vatPence),
    itemAmount: toPounds(pricePence),
    vatLines: { net: toPounds(pricePence), vat: toPounds(vatPence), ratePercent: basisPoints / 100 },
  };
}
