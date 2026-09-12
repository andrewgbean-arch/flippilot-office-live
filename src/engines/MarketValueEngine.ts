export function marketValueEngine(vehicle: any): number {
  const base = vehicle.valuation ?? vehicle.sellPrice ?? vehicle.buyPrice ?? 0;
  const mileage = vehicle.mileage ?? 60000;

  let adj = base;

  if (mileage > 120000) adj -= 800;
  else if (mileage > 90000) adj -= 500;
  else if (mileage < 40000) adj += 400;

  return Math.max(0, Math.round(adj));
}
