import { isPositiveAmount, isValidVatRate } from "@/lib/parseMoney";

export interface VatConfig {
  vatRate: number;        // e.g. 0.2 for 20%
  vatIncluded: boolean;   // true = amount includes VAT
  vatReclaimable: boolean;
}

export interface VatBreakdown {
  gross: number;   // amount including VAT
  net: number;     // amount excluding VAT
  vat: number;     // VAT portion
}

export function calculateVat(
  amount: number,
  config: VatConfig
): VatBreakdown {
  const rate = config.vatRate;

  if (config.vatIncluded) {
    const net = amount / (1 + rate);
    const vat = amount - net;
    return { gross: amount, net, vat };
  } else {
    const vat = amount * rate;
    const gross = amount + vat;
    return { gross, net: amount, vat };
  }
}

export interface MarginVatBreakdown {
  margin: number; // sale price minus purchase price, floored at 0
  vat: number;    // VAT due on the margin under the UK VAT Margin Scheme
  net: number;    // margin net of that VAT
}

// UK VAT Margin Scheme (HMRC Notice 718) — the standard basis most
// independent used-car dealers actually trade under, and completely
// different from calculateVat() above: VAT is due only on the DEALER'S
// MARGIN (sale price minus purchase price), not on the sale price
// itself, and it's nil if the car sells at a loss. The margin is
// treated as VAT-inclusive, so VAT = margin × rate / (1 + rate) — e.g.
// 1/6 of the margin at the standard 20% rate. Reconditioning/parts
// costs are deliberately NOT deducted from the margin here — under the
// scheme those are accounted for separately as normal input VAT if the
// supplier charged VAT, not folded into this calculation.
export function calculateMarginVat(
  salePrice: number,
  purchasePrice: number,
  vatRate: number
): MarginVatBreakdown {
  const margin = Math.max(0, salePrice - purchasePrice);
  const vat = margin * (vatRate / (1 + vatRate));
  const net = margin - vat;
  return { margin, vat, net };
}

// Margin VAT for a RECORDED sale: null when it cannot be worked out honestly.
//
// calculateMarginVat above is only the arithmetic, and it happily works from any
// number it is handed. A purchase price saved as 0 (the old blank), as nothing
// (null/NaN), as text or as a negative is not a price, but as a "cost of £0" it
// made the WHOLE sale price the margin: a £6,000 sale stored £1,000 of margin VAT
// (the real figure on a £5,000 car is £166.67) next to a profit of "—". Anything
// that stores or shows a sale's margin VAT goes through this instead:
//   - the purchase price must be a real amount above zero,
//   - the sale price must be a finite number,
//   - the VAT rate must be a real rate (0 to 1).
// Otherwise there is no figure, and nothing is stored or shown as one.
export function marginVatForSale(salePrice: unknown, purchasePrice: unknown, vatRate: unknown): MarginVatBreakdown | null {
  if (!isPositiveAmount(purchasePrice)) return null;
  if (typeof salePrice !== "number" || !Number.isFinite(salePrice)) return null;
  if (!isValidVatRate(vatRate)) return null;
  return calculateMarginVat(salePrice, purchasePrice, vatRate);
}
