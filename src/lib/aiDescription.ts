import { authHeaders } from "@/lib/authToken";

const BASE_URL = "http://localhost:4001";

export async function generateVehicleDescription(input: {
  make?: string;
  model?: string;
  year?: number | null;
  mileage?: number | null;
  colour?: string | null;
  condition?: string;
  motStatus?: string | null;
  motExpiry?: string | null;
  priceRetail?: number | null;
  notes?: string | null;
}): Promise<{ ok: boolean; error?: string; description?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/ai/vehicle-description`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error, description: data.description };
  } catch (err) {
    console.error("generateVehicleDescription: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}
