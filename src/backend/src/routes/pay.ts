import { Express, Request } from "express";
import { readCollection, readTenantCollection, writeTenantCollection } from "../db";
import { requireAuth, requireOwner, type AuthUser, type StoredUser } from "../auth";
import { computePaySummary, type PaySummary, type TimeEntryLike } from "../engines/payEngine";

// PAY SUMMARY — gross pay for clocked hours at an owner-set hourly
// rate. NOT a payslip (no tax/NI/pension/holiday/sick pay) — see
// engines/payEngine.ts for exactly what is and isn't computed.
//
// Access is deliberately tight, because this is other people's wages:
//   - Setting or reading RATES is owner-only. Rates live in their own
//     store, never on WorkPattern — GET /work-patterns is readable by
//     every staff member, so a rate there would show everyone's wage
//     to everyone.
//   - A staff member can only ever see their OWN summary (and so their
//     own rate, which they need to see how their gross was worked out).
//   - Only the owner can look at anyone else's.

const RATES_COLLECTION = "payRates";

export interface PayRate {
  userId: string;
  hourlyRate: number;
  updatedAt: string;
  updatedByName: string;
}

function authedUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

function teamOf(dealershipId: string): StoredUser[] {
  return readCollection<StoredUser>("users").filter(u => u.dealershipId === dealershipId);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PERIOD_DAYS = 366;

// yyyy-mm-dd parsed as a UTC date only to count days between two keys —
// never to decide which calendar day a shift belongs to (that's London
// time, in payEngine).
function daysBetween(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;
}

// Date.parse alone isn't enough: V8 quietly rolls "2026-02-31" over to 3
// March. Formatting the parsed value back and comparing catches that.
function isRealDate(key: string): boolean {
  const ms = Date.parse(`${key}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === key;
}

function parsePeriod(query: Request["query"]): { start: string; end: string } | { error: string } {
  const { start, end } = query;
  if (typeof start !== "string" || typeof end !== "string" || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    return { error: "start and end (yyyy-mm-dd) are required" };
  }
  if (!isRealDate(start) || !isRealDate(end)) {
    return { error: "start and end must be real dates" };
  }
  if (end < start) return { error: "end can't be before start" };
  if (daysBetween(start, end) > MAX_PERIOD_DAYS) return { error: "That period is too long" };
  return { start, end };
}

function rateFor(rates: PayRate[], userId: string): number | null {
  return rates.find(r => r.userId === userId)?.hourlyRate ?? null;
}

export default function registerPayRoute(app: Express) {
  // Every rate in the dealership — owner only.
  app.get("/pay/rates", requireAuth, requireOwner, (req, res) => {
    const user = authedUser(req);
    res.json({ ok: true, items: readTenantCollection<PayRate>(user.dealershipId, RATES_COLLECTION) });
  });

  app.put("/pay/rates/:userId", requireAuth, requireOwner, (req, res) => {
    const user = authedUser(req);
    const { hourlyRate } = req.body ?? {};

    // Real money, so validated properly rather than trusted: a finite
    // positive number, penny precision, and a sanity ceiling that
    // catches a typo (e.g. 1250 for 12.50) before it becomes someone's
    // wage.
    if (typeof hourlyRate !== "number" || !Number.isFinite(hourlyRate) || hourlyRate <= 0) {
      return res.status(400).json({ ok: false, error: "hourlyRate must be a number greater than zero" });
    }
    if (hourlyRate > 500) {
      return res.status(400).json({ ok: false, error: "That hourly rate looks too high — check it and try again" });
    }
    // Tolerance for floating-point noise (11.44 * 100 isn't exactly 1144).
    if (Math.abs(Math.round(hourlyRate * 100) - hourlyRate * 100) > 1e-6) {
      return res.status(400).json({ ok: false, error: "hourlyRate can't have more than two decimal places" });
    }

    // Only ever a real person in THIS dealership, never trusted from the
    // URL alone.
    const target = teamOf(user.dealershipId).find(u => u.id === req.params.userId);
    if (!target) {
      return res.status(404).json({ ok: false, error: "That person wasn't found" });
    }

    const rates = readTenantCollection<PayRate>(user.dealershipId, RATES_COLLECTION);
    const entry: PayRate = {
      userId: target.id,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      updatedAt: new Date().toISOString(),
      updatedByName: user.name,
    };
    writeTenantCollection(user.dealershipId, RATES_COLLECTION, [
      ...rates.filter(r => r.userId !== target.id),
      entry,
    ]);
    res.json({ ok: true, rate: entry });
  });

  // Clearing a rate (set by mistake, or someone leaves the payroll) —
  // there's no way to express "no rate" via PUT since zero is rejected.
  app.delete("/pay/rates/:userId", requireAuth, requireOwner, (req, res) => {
    const user = authedUser(req);
    const rates = readTenantCollection<PayRate>(user.dealershipId, RATES_COLLECTION);
    writeTenantCollection(
      user.dealershipId,
      RATES_COLLECTION,
      rates.filter(r => r.userId !== req.params.userId)
    );
    res.json({ ok: true });
  });

  // Your own summary — or, for the owner, anyone's via ?userId=.
  app.get("/pay/summary", requireAuth, (req, res) => {
    const user = authedUser(req);
    const period = parsePeriod(req.query);
    if ("error" in period) return res.status(400).json({ ok: false, error: period.error });

    const requestedId = typeof req.query.userId === "string" && req.query.userId ? req.query.userId : user.id;

    let subject: { id: string; name: string };
    if (requestedId === user.id) {
      subject = { id: user.id, name: user.name };
    } else {
      // Someone else's pay: owner only. Checked BEFORE looking the
      // person up, so a non-owner learns nothing about who exists.
      if (user.role !== "owner") {
        return res.status(403).json({ ok: false, error: "You can only view your own pay summary" });
      }
      const target = teamOf(user.dealershipId).find(u => u.id === requestedId);
      if (!target) return res.status(404).json({ ok: false, error: "That person wasn't found" });
      subject = { id: target.id, name: target.name };
    }

    const entries = readTenantCollection<TimeEntryLike>(user.dealershipId, "timekeeping");
    const rates = readTenantCollection<PayRate>(user.dealershipId, RATES_COLLECTION);

    const summary = computePaySummary({
      entries,
      userId: subject.id,
      userName: subject.name,
      hourlyRate: rateFor(rates, subject.id),
      start: period.start,
      end: period.end,
    });
    res.json({ ok: true, summary });
  });

  // Everyone at once — the owner's overview. Totals only (the per-day
  // breakdown for one person is a separate call), and includes people
  // with no rate set so the owner can see who still needs one.
  app.get("/pay/team-summary", requireAuth, requireOwner, (req, res) => {
    const user = authedUser(req);
    const period = parsePeriod(req.query);
    if ("error" in period) return res.status(400).json({ ok: false, error: period.error });

    const entries = readTenantCollection<TimeEntryLike>(user.dealershipId, "timekeeping");
    const rates = readTenantCollection<PayRate>(user.dealershipId, RATES_COLLECTION);

    const summaries: (Omit<PaySummary, "days"> & { role: string })[] = teamOf(user.dealershipId).map(member => {
      const { days, ...rest } = computePaySummary({
        entries,
        userId: member.id,
        userName: member.name,
        hourlyRate: rateFor(rates, member.id),
        start: period.start,
        end: period.end,
      });
      return { ...rest, role: member.role === "owner" ? "owner" : (member.staffRole ?? "general") };
    });

    res.json({ ok: true, summaries });
  });
}
