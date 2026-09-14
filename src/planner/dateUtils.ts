import type { WeekDay } from "./plannerTypes";

// Formats the Date's LOCAL calendar date, not toISOString()'s UTC one —
// toISOString() converts local midnight to UTC and silently rolls back
// to the previous day whenever the browser's timezone is ahead of UTC
// (true for the UK for most of the year, under BST), which showed up
// as real generated shifts landing on the wrong day entirely.
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun .. 6 = Sat
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  return `${monday.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}

const WEEKDAY_BY_GETDAY: WeekDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Counts how many days in [startDate, endDate] (both yyyy-mm-dd,
// inclusive) fall on one of `workingDays` — used to deduct leave
// against a holiday entitlement in actual working days, not calendar
// days, so a part-timer's day off doesn't cost them a "day" they
// never worked anyway. Falls back to a plain Mon–Fri working week when
// no pattern (empty `workingDays`) has been set for that person.
// Deliberately builds Date objects from the y/m/d components rather
// than parsing the string directly or ever round-tripping through
// toISOString() — see dateUtils.toDateKey for the exact UTC-rollback
// bug that pattern caused elsewhere in this feature.
export function countLeaveWorkingDays(startDate: string, endDate: string, workingDays: WeekDay[]): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 0;

  const days: WeekDay[] = workingDays.length > 0 ? workingDays : ["mon", "tue", "wed", "thu", "fri"];
  const cursor = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  let count = 0;
  while (cursor <= end) {
    if (days.includes(WEEKDAY_BY_GETDAY[cursor.getDay()]!)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}
