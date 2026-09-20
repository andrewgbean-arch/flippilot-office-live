// A customer with no account asking a dealer to watch for a car. Deliberately no
// auth headers anywhere in this file, like publicBookingApi.ts.
import { BASE_URL } from "@/lib/apiBaseUrl";
import type { PublicVehicle } from "./publicBookingApi";

export interface WantedFormInfo {
  // The exact words the person agrees to. The server writes them, the form shows
  // them, and the server stores them with the request.
  consentWording: string;
  accepting: boolean;
}

export interface WantedPayload {
  consent: true;
  name: string;
  phone?: string;
  email?: string;
  make?: string;
  model?: string;
  maxPrice?: number;
  note?: string;
  // A box real people never see; a script that fills it in gets nothing kept.
  website: string;
}

export type WantedResult = { ok: true; inStockNow: PublicVehicle[] } | { ok: false; error: string };

// null when the wording could not be loaded, and then there is no form at all:
// nobody is asked to agree to words they were not shown.
export async function loadWantedFormInfo(dealershipId: string): Promise<WantedFormInfo | null> {
  try {
    const res = await fetch(`${BASE_URL}/public/${encodeURIComponent(dealershipId)}/wanted`);
    const data = await res.json();
    if (!res.ok || !data.ok || typeof data.consentWording !== "string") return null;
    return { consentWording: data.consentWording, accepting: data.accepting !== false };
  } catch (err) {
    console.error("loadWantedFormInfo: backend unreachable", err);
    return null;
  }
}

export async function submitWanted(dealershipId: string, payload: WantedPayload): Promise<WantedResult> {
  try {
    const res = await fetch(`${BASE_URL}/public/${encodeURIComponent(dealershipId)}/wanted`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return { ok: false, error: typeof data.error === "string" ? data.error : "Something went wrong. Please try again." };
    return { ok: true, inStockNow: Array.isArray(data.inStockNow) ? data.inStockNow : [] };
  } catch (err) {
    console.error("submitWanted: backend unreachable", err);
    return { ok: false, error: "Network error. Please check your connection and try again." };
  }
}
