import { authHeaders } from "@/lib/authToken";

export interface MOTRecord {
  date?: string;
  year?: number;
  result: "PASS" | "FAIL";
  mileage?: number | null;
  advisories: string[];
  failures: string[];
  testNumber?: string | null;
  expiryDate?: string | null;
}

export interface MOTData {
  reg: string;
  make: string | null;
  model: string | null;
  year: number | null;
  colour: string | null;
  mileage: number | null;
  expiry: string | null;

  // Matches Vehicle.mot.fuelType/euroStatus — only populated once
  // DVLA_API_KEY is configured, null until then.
  fuelType: string | null;
  euroStatus: string | null;

  // Matches Vehicle.mot.historyScore
  historyScore: number;

  // Matches Vehicle.mot.history
  history: MOTRecord[];

  // Matches Vehicle.mot.advisories
  advisories: string[];
}

export async function fetchMOT(reg: string): Promise<MOTData | null> {
  try {
    // /dvla now requires auth (a security review found it was reachable
    // by anyone, spending this app's real DVSA/DVLA API quota with no
    // login at all) — needs the same auth header every other real data
    // call already sends.
    const response = await fetch(
      `http://localhost:4001/dvla?reg=${encodeURIComponent(reg)}`,
      { headers: authHeaders() }
    );

    const data = await response.json();

    if (!data.ok || !data.vehicle) {
      return null;
    }

    const v = data.vehicle;

    return {
      reg,
      make: v.make ?? null,
      model: v.model ?? null,
      year: v.year ?? null,
      colour: v.colour ?? null,
      mileage: v.mileage ?? null,
      expiry: v.expiry ?? null,
      fuelType: v.fuelType ?? null,
      euroStatus: v.euroStatus ?? null,

      historyScore: v.historyScore ?? 0,
      advisories: v.advisories ?? [],

      history: (v.history ?? []).map((h: any) => ({
        date: h.date ?? null,
        year: h.year ?? null,
        result: h.result ?? "PASS",
        mileage: h.mileage ?? null,
        advisories: h.advisories ?? [],
        failures: h.failures ?? [],
        testNumber: h.testNumber ?? null,
        expiryDate: h.expiryDate ?? null,
      })),
    };
  } catch (err) {
    console.log("MOT/DVLA lookup failed:", err);
    return null;
  }
}
