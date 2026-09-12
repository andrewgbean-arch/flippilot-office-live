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
