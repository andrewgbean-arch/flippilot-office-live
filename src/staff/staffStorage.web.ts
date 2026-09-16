import type { StaffRecord } from "@/staff/staffTypes";
import { authHeaders } from "@/lib/authToken";

const BASE_URL = "http://localhost:4001";

// Was localStorage-only — staff records never left the one browser they
// were created in. Same function signatures, now backed by the real
// backend (src/backend/src/routes/staff.ts) instead. This endpoint now
// requires auth (see backend/src/server.ts), hence authHeaders() below.
// Returns whether the write actually succeeded — a caller that ignores
// this (as every one did before) shows "Saved" even on a 403 (a
// non-manager account) or a real server error, with the record quietly
// gone again on the next reload.
export async function saveStaff(staff: StaffRecord[]): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/staff`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ items: staff }),
    });
    return res.ok;
  } catch (err) {
    console.error("saveStaff: backend unreachable", err);
    return false;
  }
}

export async function loadStaff(): Promise<StaffRecord[]> {
  try {
    const res = await fetch(`${BASE_URL}/staff`, { headers: authHeaders() });
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("loadStaff: backend unreachable", err);
    return [];
  }
}

export async function deleteStaff(id: string) {
  const staff = await loadStaff();
  const updated = staff.filter(s => s.id !== id);
  await saveStaff(updated);
  return updated;
}
