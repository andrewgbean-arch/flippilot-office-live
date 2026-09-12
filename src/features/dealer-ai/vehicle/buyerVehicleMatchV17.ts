import { FlipRecord } from "@/features/vehicles/models/FlipRecord";


  // your existing logic here


export function buyerVehicleMatchV17(vehicle: FlipRecord, buyer: any) {
  const credit = buyer?.creditScore ?? 600;
  const budget = buyer?.budget ?? vehicle.price ?? 0;
  const persona = buyer?.persona ?? "General";

  const price = vehicle.price ?? vehicle.valuation ?? 0;
  const condition = (vehicle as any).conditionScore ?? 70;

  let score = 50;

  // Budget fit
  score += price <= budget ? 20 : -10;

  // Credit fit
  score += credit > 700 ? 15 : credit > 550 ? 5 : -10;

  // Condition fit
  score += condition > 70 ? 10 : condition < 50 ? -10 : 0;

  // Persona fit
  if (persona === "Premium" && price > 8000) score += 10;
  if (persona === "Budget" && price < 3000) score += 10;

  score = Math.max(0, Math.min(100, score));

  const band =
    score >= 80
      ? "Perfect Match"
      : score >= 60
      ? "Strong Match"
      : score >= 40
      ? "Moderate Match"
      : "Weak Match";

  return { score, band };
}
