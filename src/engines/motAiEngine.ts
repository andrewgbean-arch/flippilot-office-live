export type MotAiResult = {
  healthScore: number;
  riskLevel: "low" | "medium" | "high";
  predictedPassChance: number;
  nextTestRisk: string;
  advisorySeverity: number;
  failureSeverity: number;
  mileageRisk: number;
  verdict: string;
};

export function motAiEngine(mot: any, history: any[]): MotAiResult {
  const advisories = Array.isArray(mot?.advisories) ? mot.advisories.length : 0;
  const failures   = Array.isArray(mot?.failures)   ? mot.failures.length   : 0;

  const lastMileageEntry = history?.length ? history[history.length - 1] : null;
  const mileage = lastMileageEntry?.mileage ?? 0;

  const mileageRisk =
    mileage > 180000 ? 95 :
    mileage > 150000 ? 85 :
    mileage > 120000 ? 70 :
    mileage > 90000  ? 50 :
    mileage > 60000  ? 30 :
    mileage > 30000  ? 15 : 5;

  const advisorySeverity = Math.min(advisories * 10, 100);
  const failureSeverity  = Math.min(failures * 22, 100);

  const baseHealth =
    100 -
    advisorySeverity * 0.35 -
    failureSeverity * 0.65 -
    mileageRisk * 0.25;

  const healthScore = Math.max(0, Math.min(100, Math.round(baseHealth)));

  const predictedPassChance =
    healthScore >= 90 ? 97 :
    healthScore >= 75 ? 90 :
    healthScore >= 60 ? 78 :
    healthScore >= 45 ? 62 :
    healthScore >= 30 ? 45 : 25;

  const riskLevel =
    healthScore >= 70 ? "low" :
    healthScore >= 45 ? "medium" : "high";

  const nextTestRisk =
    riskLevel === "low"
      ? "Strong chance of passing next MOT with no major issues."
      : riskLevel === "medium"
      ? "Moderate risk — advisories or wear may cause MOT complications."
      : "High risk — failures or severe wear likely to cause MOT failure.";

  const verdict =
    riskLevel === "low"
      ? "Vehicle MOT condition is healthy. No critical issues detected."
      : riskLevel === "medium"
      ? "Vehicle shows signs of wear. Advisories should be addressed soon."
      : "Vehicle MOT condition is poor. Failures or severe advisories detected.";

  return {
    healthScore,
    riskLevel,
    predictedPassChance,
    nextTestRisk,
    advisorySeverity,
    failureSeverity,
    mileageRisk,
    verdict,
  };
}
