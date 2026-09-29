// Cars the Acquisition Ledger must show even though the books hold no purchase
// for them. The ledger used to be built from purchases alone, so a sold car with
// no purchase (a car imported from a spreadsheet and then sold, say) appeared
// nowhere in the books, although the dashboard counts it as a sale left out of
// Profit This Month. On one car's own page (vehicleId given) that car is shown
// whenever it exists, sold or not, so its purchase can be recorded from there.
export function vehiclesMissingPurchase(
  sales: { vehicleId: string }[],
  purchases: { vehicleId: string }[],
  vehicles: { id: string }[],
  vehicleId?: string
): string[] {
  const purchased = new Set(purchases.map((p) => p.vehicleId));
  if (vehicleId) {
    if (purchased.has(vehicleId)) return [];
    const known = vehicles.some((v) => v.id === vehicleId) || sales.some((s) => s.vehicleId === vehicleId);
    return known ? [vehicleId] : [];
  }
  const out: string[] = [];
  for (const s of sales) {
    if (!purchased.has(s.vehicleId) && !out.includes(s.vehicleId)) out.push(s.vehicleId);
  }
  return out;
}
