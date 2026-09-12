export function competitorEngine(vehicle: any): number {
  const marketAvg = vehicle.marketAvg ?? 5000;
  const mileage = vehicle.mileage ?? 80000;

  let competitors = Math.round((marketAvg / 5000) * 3);

  if (mileage < 60000) competitors += 2;
  if (mileage > 120000) competitors -= 1;

  return Math.max(1, competitors);
}
