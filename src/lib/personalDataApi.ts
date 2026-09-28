import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

// "Download my data" (and the owner's download of a teammate's data): the
// server sends one JSON file of everything held about the person. The web app
// is on a different origin from the backend, and CORS hides the server's
// suggested file name, so the name is made here from the person's name.
export async function downloadPersonalData(personName: string, memberId?: string): Promise<{ ok: boolean; error?: string }> {
  const path = memberId ? `/dealership/team/${encodeURIComponent(memberId)}/data-export` : "/me/data-export";
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error ?? "Couldn't download the data. Please try again." };
    }
    const blob = await res.blob();
    const safeName = personName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "person";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `flippilot-data-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (err) {
    console.error("downloadPersonalData: backend unreachable", err);
    return { ok: false, error: "Backend unreachable. Try again." };
  }
}
