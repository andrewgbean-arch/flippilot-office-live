// Decodes what a VIN genuinely encodes — manufacturer (from the WMI,
// first 3 characters) and model year (from character 10) — using a
// small table of common European WMIs. Deliberately does NOT guess at
// model/body/engine/mileage/profit: a VIN doesn't encode any of those,
// and previous versions of this fabricated them (hardcoded "Focus" for
// every Ford, "1.0 EcoBoost" for every vehicle regardless of make,
// £1800 "estimated profit" no matter what) which looked like a real
// scan result but was static noise.
export function decodeVIN(vin: string) {
  if (!vin || vin.length !== 17) {
    return { error: "VIN must be exactly 17 characters" };
  }

  const wmi = vin.substring(0, 3);

  const wmiMakes: Record<string, string> = {
    WF0: "Ford",
    WVW: "Volkswagen",
    WDB: "Mercedes",
    WBA: "BMW",
    SB1: "Toyota",
  };
  const make = wmiMakes[wmi] ?? "Unknown";

  const yearCode = vin[9] ?? "";
  const yearMap: Record<string, number> = {
    A: 2010, B: 2011, C: 2012, D: 2013, E: 2014,
    F: 2015, G: 2016, H: 2017, J: 2018, K: 2019,
    L: 2020, M: 2021, N: 2022, P: 2023, R: 2024,
    S: 2025, T: 2026,
  };
  const year = yearMap[yearCode] ?? null;

  return { vin, make, year };
}
