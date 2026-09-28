import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

// A customer's request to see or erase what the dealership holds about them
// (backend customerData.ts). Owner and managers only.

export type CustomerRecord = Record<string, unknown> & { id: string };

export interface CustomerDataPlace {
  key: string;
  label: string;
  records: CustomerRecord[];
}

export interface CustomerDataResult {
  searchedFor: { email: string | null; phone: string | null };
  searchedAt: string;
  places: CustomerDataPlace[];
  recentlyDeleted: CustomerRecord[];
  keptSales: CustomerRecord[];
  keptNote: string;
}

export interface Who {
  email?: string;
  phone?: string;
}

async function post<T>(path: string, body: object): Promise<({ ok: true } & T) | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? "Something went wrong. Please try again." };
    return data;
  } catch {
    return { ok: false, error: "Backend unreachable. Try again." };
  }
}

export const searchCustomerData = (who: Who) => post<CustomerDataResult>("/customer-data/search", who);

export const eraseCustomerData = (who: Who) =>
  post<{ erased: Record<string, number>; keptSales: number; keptNote: string }>("/customer-data/erase", { ...who, confirm: true });

// Hands the search result over as a file, for sending to the person.
export function downloadCustomerData(result: CustomerDataResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `customer-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
