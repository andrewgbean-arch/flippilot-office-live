import type { StaffRecord } from "@/staff/staffTypes";
import { authHeaders } from "@/lib/authToken";
import { loadList } from "@/lib/loadJson";

import { BASE_URL } from "@/lib/apiBaseUrl";

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

// null = the staff list couldn't be read (dropped connection,
// 401/402/403/5xx, not a list). [] only ever means the server said there
// are none. Every add/update/remove re-reads this list and saves it back
// with the change, so a failed read taken for "no staff" replaced the
// whole roster with just the one record being added (see loadJson.ts).
export async function loadStaff(): Promise<StaffRecord[] | null> {
  return loadList<StaffRecord>("/staff");
}

// null = nothing was deleted because the current list couldn't be read.
export async function deleteStaff(id: string): Promise<StaffRecord[] | null> {
  const staff = await loadStaff();
  if (staff === null) return null;
  const updated = staff.filter(s => s.id !== id);
  await saveStaff(updated);
  return updated;
}
