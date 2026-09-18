import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

// Photos taken on a phone are stored on the server; the vehicle's `images`
// list just holds their addresses. A plain save of the stock list can't
// remove one (the server puts it back), so removing it goes through here.

const HOSTED_PHOTO =
  /\/photos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.(?:jpg|png|webp))?(?:[?#].*)?$/i;

// The server's id for a hosted photo's URL, or null for anything else (an
// inline picture uploaded on the web, or someone else's address).
export function hostedPhotoId(url: string): string | null {
  if (url.length > 500) return null;
  const match = HOSTED_PHOTO.exec(url);
  return match ? (match[1] ?? "").toLowerCase() : null;
}

export async function deleteVehiclePhoto(
  vehicleId: string,
  photoId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/inventory/${encodeURIComponent(vehicleId)}/photos/${photoId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) return { ok: true };
    // Already gone (removed on the phone in the meantime) is the outcome we wanted.
    if (res.status === 404) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data?.error ?? "Couldn't remove a photo" };
  } catch (err) {
    console.error("deleteVehiclePhoto: backend unreachable", err);
    return { ok: false, error: "Couldn't reach the server to remove a photo" };
  }
}
