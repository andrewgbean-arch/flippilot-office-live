import type { StaffRecord } from "@/staff/staffTypes";

const DAY_MS = 86_400_000;

// `joinedAt` is set to "now" when the staff record is created in FlipPilot
// (staff/AddStaff.tsx), not when the person started work, so this is how long
// people have been on FlipPilot, not their tenure. The screen used to call it
// "Avg Tenure". Records with no usable date are left out of the average, and
// with nobody to average over there is no figure at all (null) rather than a 0.
export function averageDaysOnApp(staff: readonly Pick<StaffRecord, "joinedAt">[], now: Date): number | null {
  const days = staff
    .map(s => new Date(s.joinedAt).getTime())
    .filter(t => Number.isFinite(t))
    .map(t => Math.max(0, (now.getTime() - t) / DAY_MS));
  if (days.length === 0) return null;
  return Math.round(days.reduce((sum, d) => sum + d, 0) / days.length);
}
