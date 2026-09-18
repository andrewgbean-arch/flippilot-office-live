// A PAY SUMMARY — deliberately not a payslip. A real UK payslip has
// statutory content (gross, deductions, net) this app doesn't compute:
// no tax, National Insurance, pension, holiday or sick pay, overtime
// rates or unpaid-break handling. What this does compute, honestly, is
// GROSS pay for the hours a person actually clocked (Timekeeping) at
// the hourly rate the owner set for them — nothing more. Every screen
// that shows it says so.
//
// Pure functions only — no I/O — so the maths is unit-testable.

export interface TimeEntryLike {
  id: string;
  userId: string;
  clockIn: string; // ISO
  clockOut: string | null; // ISO, null while still clocked in
}

export interface PayEntry {
  id: string;
  clockIn: string;
  clockOut: string;
  hours: number; // 2dp, for display
}

export interface PayDay {
  date: string; // yyyy-mm-dd, London calendar date the shift started
  hours: number;
  entries: PayEntry[];
}

export interface PaySummary {
  userId: string;
  userName: string;
  start: string;
  end: string;
  hourlyRate: number | null;
  totalHours: number;
  // null when no rate has been set — hours are still shown, but a pay
  // figure is never guessed.
  grossPay: number | null;
  days: PayDay[];
  // True when the person is clocked in right now (an unfinished shift
  // that started in this period) — it isn't counted until they clock out.
  openShift: boolean;
}

// This product is for UK dealers, and the server itself runs in UTC, so
// "which day did this shift happen on" has to be decided in London time:
// a 23:30 shift end-of-day in BST is 22:30 UTC, and a 00:30 BST clock-in
// is 23:30 UTC the day BEFORE. Attributed to the London date the shift
// STARTED, which is the normal payroll convention for overnight work.
const LONDON = "Europe/London";
const londonDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: LONDON,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function londonDateKey(iso: string): string {
  return londonDateFormat.format(new Date(iso)); // en-CA => yyyy-mm-dd
}

// Whole minutes, so totals add up exactly rather than accumulating
// floating-point hours. A missing/garbled/negative entry counts for 0.
function entryMinutes(entry: { clockIn: string; clockOut: string }): number {
  const ms = Date.parse(entry.clockOut) - Date.parse(entry.clockIn);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 60000);
}

const toHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

export function computePaySummary(input: {
  entries: TimeEntryLike[];
  userId: string;
  userName: string;
  hourlyRate: number | null;
  start: string; // yyyy-mm-dd inclusive
  end: string; // yyyy-mm-dd inclusive
}): PaySummary {
  const { entries, userId, userName, hourlyRate, start, end } = input;

  const inPeriod = entries.filter(e => {
    if (e.userId !== userId) return false;
    const day = londonDateKey(e.clockIn);
    return day >= start && day <= end;
  });

  const openShift = inPeriod.some(e => e.clockOut === null);

  const byDay = new Map<string, PayEntry[]>();
  let totalMinutes = 0;
  for (const e of inPeriod) {
    if (e.clockOut === null) continue; // not counted until clocked out
    const minutes = entryMinutes({ clockIn: e.clockIn, clockOut: e.clockOut });
    if (minutes === 0) continue;
    totalMinutes += minutes;
    const day = londonDateKey(e.clockIn);
    const list = byDay.get(day) ?? [];
    list.push({ id: e.id, clockIn: e.clockIn, clockOut: e.clockOut, hours: toHours(minutes) });
    byDay.set(day, list);
  }

  const days: PayDay[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => {
      list.sort((a, b) => a.clockIn.localeCompare(b.clockIn));
      const dayMinutes = list.reduce((sum, e) => sum + entryMinutes(e), 0);
      return { date, hours: toHours(dayMinutes), entries: list };
    });

  return {
    userId,
    userName,
    start,
    end,
    hourlyRate,
    totalHours: toHours(totalMinutes),
    grossPay: hourlyRate === null ? null : Math.round((totalMinutes * hourlyRate * 100) / 60) / 100,
    days,
    openShift,
  };
}
