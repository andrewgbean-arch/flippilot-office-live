import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

// Real customer database with real, recorded marketing consent —
// separate from Leads (sales pipeline) and Contacts (supplier address
// book). No send capability exists yet on top of this; consent is
// tracked here so a future email/WhatsApp feature has something real
// and legal to check before sending anything.

export type ConsentStatus = "not_asked" | "opted_in" | "opted_out";

export interface MarketingConsent {
  status: ConsentStatus;
  method?: string;
  consentedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  vehicleInterests?: string;
  tags?: string[];
  emailConsent: MarketingConsent;
  whatsappConsent: MarketingConsent;
  sourceLeadId?: string;
  notes?: string;
  createdAt: string;
  createdByName: string;
  updatedAt: string;
}

export async function fetchCustomers(): Promise<{ ok: boolean; items: Customer[]; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/customers`, { headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, items: data.items ?? [], error: data.error };
  } catch (err) {
    console.error("fetchCustomers: backend unreachable", err);
    return { ok: false, items: [], error: "Network error" };
  }
}

export interface NewCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  vehicleInterests?: string;
  tags?: string[];
  emailConsent?: MarketingConsent;
  whatsappConsent?: MarketingConsent;
  sourceLeadId?: string;
  notes?: string;
}

export async function createCustomer(input: NewCustomerInput): Promise<{ ok: boolean; entry?: Customer; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return { ok: res.ok, entry: data.entry, error: data.error };
  } catch (err) {
    console.error("createCustomer: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function updateCustomer(
  id: string,
  patch: Partial<NewCustomerInput>
): Promise<{ ok: boolean; entry?: Customer; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    return { ok: res.ok, entry: data.entry, error: data.error };
  } catch (err) {
    console.error("updateCustomer: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function deleteCustomer(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/customers/${id}`, { method: "DELETE", headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, error: data.error };
  } catch (err) {
    console.error("deleteCustomer: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}
