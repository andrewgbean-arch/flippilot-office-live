export function sellTimeEngine(demand: number, daysListed: number): number {
  let days = 14 - demand / 8 + daysListed / 4;
  return Math.max(3, Math.round(days));
}
