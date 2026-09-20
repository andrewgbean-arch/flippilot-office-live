import { readOptionalMoney } from "@/lib/parseMoney";

// The two price columns of a vehicle CSV, read strictly.
//
// The import used to do `Number(text) || null`, which drops a perfectly ordinary
// "£5,000" (Excel's currency format) without a word, so the car arrived with no
// price and nothing said so. Now a price that reads is kept ("£5,000",
// "5,000", "5000.50"), a blank (or 0) is left unset, and a price that is TYPED
// but cannot be read ("5,00", "abc", "4.500,00") is left unset AND reported, so
// the summary can say how many cars need their price checking. Nothing is
// silently zero.
export interface ImportPrices {
  buyPrice: number | null;
  sellPrice: number | null;
  // The labels of the price columns that had something in them that could not be read.
  unreadable: string[];
}

export const BUY_PRICE_LABEL = "Buy / Trade Price";
export const SELL_PRICE_LABEL = "Sell / Retail Price";

export function readImportPrices(values: { buyPrice?: string; sellPrice?: string }): ImportPrices {
  const unreadable: string[] = [];

  const buy = readOptionalMoney(values.buyPrice);
  if (!buy.ok) unreadable.push(BUY_PRICE_LABEL);

  const sell = readOptionalMoney(values.sellPrice);
  if (!sell.ok) unreadable.push(SELL_PRICE_LABEL);

  return {
    buyPrice: buy.ok ? buy.value : null,
    sellPrice: sell.ok ? sell.value : null,
    unreadable,
  };
}

// "3 rows had a price that could not be read, so it was left blank."
export function unreadablePriceSummary(rows: number): string | null {
  if (rows <= 0) return null;
  return `${rows} row${rows === 1 ? "" : "s"} had a price that could not be read, so ${
    rows === 1 ? "it was" : "those prices were"
  } left blank. Check the buy and sell prices on ${rows === 1 ? "that car" : "those cars"}.`;
}
