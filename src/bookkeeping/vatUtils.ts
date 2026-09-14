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
