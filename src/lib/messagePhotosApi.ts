import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

// Sharing a photo in a message is two steps. The photo is uploaded on its own
// first (here), which hands back an id and attaches it to nothing yet; the
// message is then sent with that id in `photoIds`. Until then the photo
// belongs to nobody but the person who uploaded it, and the server forgets
// unsent ones after a day.
//
// The `url` on a photo inside a received message is a signed link that stops
// working after 24 hours and is re-issued every time the messages are fetched.
// Show it straight away, never keep it, and never send the sign-in token with
// it (it needs none).

export type MessagePhoto = { id: string; url: string };

// The server's own wording when it gave one, otherwise something readable for
// the odd reply that isn't JSON (a proxy's error page, say).
function serverMessage(data: unknown): string | null {
  const error = (data as { error?: unknown } | null | undefined)?.error;
  return typeof error === "string" && error.trim() ? error : null;
}

function uploadFallback(status: number): string {
  if (status === 401) return "You've been signed out — sign in again to add photos";
  if (status === 413) return "That photo is too large to upload";
  return "Couldn't upload that photo — try again";
}

export async function uploadMessagePhoto(
  dataUrl: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/message-photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ dataUrl }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: serverMessage(data) ?? uploadFallback(res.status) };
    }
    const id = (data as { photo?: { id?: unknown } } | null)?.photo?.id;
    if (typeof id !== "string" || !id) {
      return { ok: false, error: "The server didn't confirm that photo — try adding it again" };
    }
    return { ok: true, id };
  } catch (err) {
    console.error("uploadMessagePhoto: backend unreachable", err);
    return { ok: false, error: "Couldn't reach the server to upload that photo" };
  }
}

// Throws away a photo that was uploaded but never sent (only its uploader can).
// Best-effort: the server sweeps unsent photos after a day anyway, so callers
// can ignore a failure here.
export async function discardMessagePhoto(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/message-photos/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) return { ok: true };
    // Already gone is the outcome we wanted.
    if (res.status === 404) return { ok: true };
    const data = await res.json().catch(() => null);
    return { ok: false, error: serverMessage(data) ?? "Couldn't remove that photo" };
  } catch (err) {
    console.error("discardMessagePhoto: backend unreachable", err);
    return { ok: false, error: "Couldn't reach the server to remove that photo" };
  }
}
