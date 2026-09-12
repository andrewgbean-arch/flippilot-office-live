export function formatMoney(value: number): string {
  return `£${value.toFixed(2)}`;
}

export function formatROI(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function proFlipBadge(isPro: boolean, score?: number): string {
  if (!isPro) return "🟦 Standard Flip";

  return `🟨 Pro Flip${score != null ? ` — Score ${score}` : ""}`;
}
