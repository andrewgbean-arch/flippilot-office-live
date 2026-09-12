import type { StaffRecord } from "@/staff/staffTypes";

const STAFF_KEY = "dealer_staff";

export async function saveStaff(staff: StaffRecord[]) {
  localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
}

export async function loadStaff(): Promise<StaffRecord[]> {
  const raw = localStorage.getItem(STAFF_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

export async function deleteStaff(id: string) {
  const staff = await loadStaff();
  const updated = staff.filter(s => s.id !== id);
  await saveStaff(updated);
  return updated;
}