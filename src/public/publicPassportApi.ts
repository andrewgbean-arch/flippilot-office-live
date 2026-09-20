// Deliberately no auth headers anywhere in this file: a buyer opens this page
// with no account (see the backend's routes/carPassport.ts).
import { BASE_URL } from "@/lib/apiBaseUrl";
import type { PublicPassport } from "./passportTypes";

export type PassportLoad =
  | { status: "ok"; passport: PublicPassport }
  // Not published, doesn't exist, or belongs to nobody: the server answers all of
  // those the same way, so this page can't tell a buyer which it was either.
  | { status: "unavailable" }
  | { status: "error" };

export async function loadPublicPassport(dealershipId: string, vehicleId: string): Promise<PassportLoad> {
  try {
    const res = await fetch(`${BASE_URL}/public/${encodeURIComponent(dealershipId)}/cars/${encodeURIComponent(vehicleId)}`);
    if (res.status === 404) return { status: "unavailable" };
    const data = await res.json();
    if (!res.ok || !data.ok || typeof data.sold !== "boolean" || !data.car) return { status: "error" };
    const { ok: _ok, ...passport } = data;
    return { status: "ok", passport: passport as PublicPassport };
  } catch (err) {
    console.error("loadPublicPassport: backend unreachable", err);
    return { status: "error" };
  }
}
