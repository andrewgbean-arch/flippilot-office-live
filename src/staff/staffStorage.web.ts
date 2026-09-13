import type { StaffRecord } from "@/staff/staffTypes";

const BASE_URL = "http://localhost:4001";

// Was localStorage-only — staff records never left the one browser they
// were created in. Same function signatures, now backed by the real
// backend (src/backend/src/routes/staff.ts) instead.
export async function saveStaff(staff: StaffRecord[]) {
  try {
    await fetch(`${BASE_URL}/staff`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: staff }),
    });
  } catch (err) {
    console.error("saveStaff: backend unreachable", err);
  }
}

export async function loadStaff(): Promise<StaffRecord[]> {
  try {
    const res = await fetch(`${BASE_URL}/staff`);
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
