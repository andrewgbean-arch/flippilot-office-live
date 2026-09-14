// Deliberately no auth headers anywhere in this file — these calls are
// made by a customer with no account, hitting the one part of the
// backend that has no login gate at all (see publicBooking.ts).
const BASE_URL = "http://localhost:4001";

export interface PublicVehicle {
  id: string;
  reg?: string;
  make: string;
  model: string;
  year: number | null;
  mileage: number | null;
  colour?: string;
  priceRetail: number | null;
}

export async function loadPublicDealerName(dealershipId: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/public/${dealershipId}/info`);
    const data = await res.json();
    return data.ok ? data.name : null;
  } catch (err) {
    console.error("loadPublicDealerName: backend unreachable", err);
    return null;
  }
}

export async function loadPublicVehicles(dealershipId: string): Promise<PublicVehicle[]> {
  try {
    const res = await fetch(`${BASE_URL}/public/${dealershipId}/vehicles`);
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("loadPublicVehicles: backend unreachable", err);
    return [];
  }
}

export async function submitBooking(
  dealershipId: string,
  input: {
    vehicleId: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    type: "viewing" | "test_drive";
    requestedDate: string;
    requestedTime: string;
    notes?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/public/${dealershipId}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return { ok: res.ok && data.ok, error: data.error };
  } catch (err) {
    console.error("submitBooking: backend unreachable", err);
    return { ok: false, error: "Network error — please check your connection and try again." };
  }
}
