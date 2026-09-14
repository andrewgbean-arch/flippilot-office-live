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
