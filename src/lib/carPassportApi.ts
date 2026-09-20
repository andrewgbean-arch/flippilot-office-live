// The dealer's side of the Car Passport: its settings for one car, saved with
// the dealer's own login. (The page a buyer sees is loaded without one, from
// src/public/publicPassportApi.ts.)
import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

export interface PassportSettings {
  published: boolean;
  showReg: boolean;
  showMot: boolean;
  showUlez: boolean;
  showMarket: boolean;
  workDone: string[];
  note: string;
  updatedAt: string;
}

export interface PassportSetup {
  config: PassportSettings;
  // Lines that could be added, from work already recorded against the car.
  suggestions: string[];
  canPublish: boolean;
  cannotPublishBecause?: string;
}

export interface PassportResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function loadPassportSetup(vehicleId: string): Promise<PassportResult<PassportSetup>> {
  try {
    const res = await fetch(`${BASE_URL}/car-passports/${encodeURIComponent(vehicleId)}`, { headers: authHeaders() });
    const body = await res.json();
    if (!res.ok || !body.ok) return { ok: false, status: res.status, error: body.error };
    return {
      ok: true,
      status: res.status,
      data: {
        config: body.config,
        suggestions: Array.isArray(body.suggestions) ? body.suggestions : [],
        canPublish: body.canPublish !== false,
        ...(typeof body.cannotPublishBecause === "string" ? { cannotPublishBecause: body.cannotPublishBecause } : {}),
      },
    };
  } catch (err) {
    console.error("carPassportApi: backend unreachable", err);
    return { ok: false, status: 0, error: "Network error" };
  }
}

export async function savePassportSettings(
  vehicleId: string,
  settings: Omit<PassportSettings, "updatedAt">
): Promise<PassportResult<PassportSettings>> {
  try {
    const res = await fetch(`${BASE_URL}/car-passports/${encodeURIComponent(vehicleId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(settings),
    });
    const body = await res.json();
    if (!res.ok || !body.ok) return { ok: false, status: res.status, error: body.error };
    return { ok: true, status: res.status, data: body.config };
  } catch (err) {
    console.error("carPassportApi: backend unreachable", err);
    return { ok: false, status: 0, error: "Network error" };
  }
}
