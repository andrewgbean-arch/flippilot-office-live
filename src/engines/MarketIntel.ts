export function demandLevel({ buyers, sellers }: { buyers: number; sellers: number }) {
  if (buyers > sellers * 1.5) return "Strong";
  if (buyers < sellers) return "Weak";
  return "Balanced";
}

export function trendDirection(prices: number[]) {
  if (prices.length < 2) return "Flat";

  const start = prices[0]!;
  const end = prices[prices.length - 1]!;

  const diff = end - start;

  if (diff > 0) return "Upward";
  if (diff < 0) return "Downward";
  return "Flat";
}

