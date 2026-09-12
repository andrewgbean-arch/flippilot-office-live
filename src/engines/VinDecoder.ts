export function decodeVIN(vin: string) {
  // Basic validation
  if (!vin || vin.length !== 17) {
    return { error: "Invalid VIN" };
  }

  // WMI (World Manufacturer Identifier)
  const wmi = vin.substring(0, 3);

  let make = "Unknown";
  if (wmi.startsWith("WF0")) make = "Ford";
  if (wmi.startsWith("WVW")) make = "Volkswagen";
  if (wmi.startsWith("WDB")) make = "Mercedes";
  if (wmi.startsWith("WBA")) make = "BMW";
  if (wmi.startsWith("SB1")) make = "Toyota";

// Model year decoding (position 10)
const yearCode = vin[9] ?? "";
const yearMap: Record<string, number> = {
  A: 2010, B: 2011, C: 2012, D: 2013, E: 2014,
  F: 2015, G: 2016, H: 2017, J: 2018, K: 2019,
  L: 2020, M: 2021, N: 2022, P: 2023, R: 2024,
  S: 2025, T: 2026
};

const year = yearMap[yearCode] ?? null;


  // Dummy model inference (for demo)
  let model = "Unknown";
  if (make === "Ford") model = "Focus";
  if (make === "Volkswagen") model = "Golf";
  if (make === "BMW") model = "3 Series";

  // Dummy body type
  const body = "Hatchback";

  // Dummy engine type
  const engine = "1.0 EcoBoost";

  // Dummy market demand
  const marketDemand = "medium";

  // Dummy estimated profit
  const estimatedProfit = 1800;

  // Dummy mileage (placeholder)
  const mileage = 45000;

  return {
    vin,
    make,
    model,
    year,
    body,
    engine,
    marketDemand,
    estimatedProfit,
    mileage
  };
}

