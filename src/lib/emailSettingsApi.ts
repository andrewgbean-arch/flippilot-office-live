import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

// "Bring your own key" email sending — each dealership connects their
// own real SendGrid account. The real API key is never sent to this
// client once saved; every response here only ever carries a masked
// hint and the non-secret from-address/name.

export interface EmailSettingsStatus {
  connected: boolean;
  provider?: "sendgrid";
  fromEmail?: string;
  fromName?: string;
  connectedAt?: string;
  connectedByName?: string;
  maskedKey?: string;
}

export async function fetchEmailSettings(): Promise<{ ok: boolean; status?: EmailSettingsStatus; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/email-settings`, { headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, status: data, error: data.error };
  } catch (err) {
    console.error("fetchEmailSettings: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function saveEmailSettings(
  apiKey: string,
  fromEmail: string,
  fromName: string
): Promise<{ ok: boolean; status?: EmailSettingsStatus; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/email-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ apiKey, fromEmail, fromName }),
    });
    const data = await res.json();
    return { ok: res.ok, status: data, error: data.error };
  } catch (err) {
    console.error("saveEmailSettings: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function disconnectEmailSettings(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/email-settings`, { method: "DELETE", headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, error: data.error };
  } catch (err) {
    console.error("disconnectEmailSettings: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/email-settings/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ to }),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error };
  } catch (err) {
    console.error("sendTestEmail: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}
