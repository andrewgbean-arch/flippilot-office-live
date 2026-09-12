export function priceMovement(prices: number[]) {
  if (!prices || prices.length < 2) return 0;

  const start = prices[0]!;
  const end = prices[prices.length - 1]!;

  return ((end - start) / start) * 100;
}

