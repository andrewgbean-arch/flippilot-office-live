import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

export interface AdminDealershipSummary {
  id: string;
  name: string;
  createdAt: string;
  subscriptionStatus: string;
  userCount: number;
}

export async function fetchAdminDealerships(): Promise<{
  ok: boolean;
  dealerships: AdminDealershipSummary[];
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/admin/dealerships`, { headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, dealerships: data.dealerships ?? [], error: data.error };
  } catch (err) {
    console.error("fetchAdminDealerships: backend unreachable", err);
    return { ok: false, dealerships: [], error: "Network error" };
  }
}

export async function deleteAdminDealership(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/admin/dealerships/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error };
  } catch (err) {
    console.error("deleteAdminDealership: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}
