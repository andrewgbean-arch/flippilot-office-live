export function marketDemandEngine(vehicle: any): number {
  const age = vehicle.age ?? 8;
  const segment = vehicle.segment ?? "hatchback";

  let demand = 50;

  if (segment === "suv") demand += 15;
  if (segment === "ev") demand += 10;
  if (segment === "diesel") demand -= 10;

  if (age > 10) demand -= 10;
  if (age < 5) demand += 10;

  return Math.min(100, Math.max(0, demand));
}
