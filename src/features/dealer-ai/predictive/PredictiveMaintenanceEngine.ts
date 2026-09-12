import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export interface MaintenancePrediction {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  estimatedCosts: {
    nextService: number;
    brakes: number;
    tyres: number;
    suspension: number;
    engine: number;
  };
  upcomingIssues: string[];
  confidence: number;
}

export function evaluateMaintenance(vehicle: FlipRecord): MaintenancePrediction {
  const mileage = vehicle.mileage ?? vehicle.mot?.mileage ?? 0;

  // ⭐ Correct year field (FlipRecord stores year inside MOT)
  const year = vehicle.mot?.year ?? null;

  const age = year ? new Date().getFullYear() - year : 10;

  const failures = vehicle.mot?.failures?.length ?? 0;
  const advisories = vehicle.mot?.advisories?.length ?? 0;

  let risk = 20;

  if (mileage > 140000) risk += 40;
  else if (mileage > 120000) risk += 30;
  else if (mileage > 100000) risk += 20;

  risk += failures * 15;
  risk += advisories * 5;

  if (age > 15) risk += 20;
  else if (age > 10) risk += 10;

  risk = Math.min(100, risk);

  const riskLevel =
    risk >= 70 ? "HIGH" :
    risk >= 40 ? "MEDIUM" :
    "LOW";

  const estimatedCosts = {
    nextService: age > 10 ? 250 : 150,
    brakes: mileage > 100000 ? 300 : 150,
    tyres: mileage > 80000 ? 280 : 180,
    suspension: riskLevel === "HIGH" ? 600 : 300,
    engine: riskLevel === "HIGH" ? 1200 : 400,
  };

  const upcomingIssues: string[] = [];

  if (mileage > 120000) upcomingIssues.push("High likelihood of suspension wear.");
  if (mileage > 140000) upcomingIssues.push("Engine components may require inspection.");
  if (failures > 0) upcomingIssues.push("MOT failures indicate unresolved issues.");
  if (advisories > 0) upcomingIssues.push("Advisories suggest future repair needs.");

  const confidence = Math.max(30, 100 - risk);

  return {
    riskLevel,
    estimatedCosts,
    upcomingIssues,
    confidence,
  };
}
