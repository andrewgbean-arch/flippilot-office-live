export interface ReconItem {
  id: string;
  name: string;
  estimatedCost: number;
  priority: "High" | "Medium" | "Low";
  risk: number; // 0–100
  recommendation: "Fix" | "Skip" | "Monitor";
}

export const ReconAIEngine = {
  generate(vehicle: any): ReconItem[] {
    const items: ReconItem[] = [];

    // ⭐ Predict tyres
    if (vehicle.mileage > 60000) {
      items.push({
        id: "tyres",
        name: "Tyres (Front/Rear)",
        estimatedCost: 280,
        priority: "High",
        risk: 70,
        recommendation: "Fix",
      });
    }

    // ⭐ Predict brakes
    if (vehicle.mileage > 50000) {
      items.push({
        id: "brakes",
        name: "Brake Pads & Discs",
        estimatedCost: 220,
        priority: "High",
        risk: 65,
        recommendation: "Fix",
      });
    }

    // ⭐ Predict service
    items.push({
      id: "service",
      name: "Full Service",
      estimatedCost: 180,
      priority: "Medium",
      risk: 40,
      recommendation: "Fix",
    });

    // ⭐ Predict bodywork
    if (vehicle.condition === "Average") {
      items.push({
        id: "bodywork",
        name: "Minor Bodywork",
        estimatedCost: 150,
        priority: "Low",
        risk: 20,
        recommendation: "Monitor",
      });
    }

    // ⭐ Predict diagnostics
    items.push({
      id: "diagnostics",
      name: "Diagnostics Scan",
      estimatedCost: 60,
      priority: "Low",
      risk: 10,
      recommendation: "Skip",
    });

    return items;
  },
};
