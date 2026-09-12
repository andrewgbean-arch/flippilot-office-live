type ShoppingResult = {
  extracted_price?: number;
  price?: string;
  unit_price?: number;
  inline_offer?: { price?: number | string };
};
export function extractGooglePrices(shopping_results: ShoppingResult[] | undefined) {
  if (!shopping_results || !shopping_results.length) {
    return { googlePriceMin: null, googlePriceMax: null };
  }
  const prices: number[] = [];
  for (const item of shopping_results) {
    if (typeof item.extracted_price === "number") {
      prices.push(item.extracted_price);
    }
    if (item.inline_offer?.price) {
      const p =
        typeof item.inline_offer.price === "number"
          ? item.inline_offer.price
          : parseFloat(String(item.inline_offer.price).replace(/[^0-9.,]/g, "").replace(",", "."));
      if (!isNaN(p)) prices.push(p);
    }
    if (item.price) {
      const p = parseFloat(item.price.replace(/[^0-9.,]/g, "").replace(",", "."));
      if (!isNaN(p)) prices.push(p);
    }
    if (typeof item.unit_price === "number") {
      prices.push(item.unit_price);
    }
  }
  if (!prices.length) {
    return { googlePriceMin: null, googlePriceMax: null };
  }
  const googlePriceMin = Math.min(...prices);
  const googlePriceMax = Math.max(...prices);
  return { googlePriceMin, googlePriceMax };
}
