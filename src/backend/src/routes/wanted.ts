import { randomUUID } from "crypto";
import { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { readCollection, readTenantCollection, writeTenantCollection } from "../db";
import { requireStaffRole, type AuthUser, type Dealership, type StoredUser } from "../auth";
import { publicVehiclesFor } from "./publicBooking";
import {
  MAX_ANNOUNCED_PER_REQUEST,
  MAX_LIVE_REQUESTS,
  RETENTION_DAYS,
  WANTED_STATUSES,
  arrivalNotices,
  consentWording,
  findRepeat,
  matchesFor,
  orderForStaff,
  parseWantedInput,
  planArrivals,
  wantedSummary,
  withoutExpired,
  type WantedForStaff,
  type WantedRequest,
  type WantedStatus,
} from "../engines/wantedRequests";

// A person's "tell me when you get one" requests. Server-owned: the dealer's
// screens never save this list as a whole, so nothing they do can overwrite a
// request that arrived a moment earlier. It is deliberately NOT one of the
// collections Pilot Brain reads: these are strangers' names and contact details.
const COLLECTION = "wantedRequests";
const MAX_SHOWN_TO_CUSTOMER = 3;

function authUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

function readRequests(dealershipId: string): WantedRequest[] {
  const raw = readTenantCollection<unknown>(dealershipId, COLLECTION);
  return raw.filter((r): r is WantedRequest => typeof r === "object" && r !== null && typeof (r as WantedRequest).id === "string");
}

// A stranger can reach the write route with no account, so it is limited hard:
// a real person asks for a car or two, a script asks for thousands.
const wantedWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 500 : 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests. Please try again later." },
});

const wantedReadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests. Please try again shortly." },
});

const sane = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 100;

// The people who would act on a wanted car: the owner, managers and sales.
function staffWhoSell(dealershipId: string): StoredUser[] {
  return readCollection<StoredUser>("users").filter(
    u => u.dealershipId === dealershipId && (u.role === "owner" || u.staffRole === "manager" || u.staffRole === "sales")
  );
}

// Called after the stock has been saved. Tells the team when a car in stock has
// just become a match for people who are still waiting, once per car per request.
// It can never get in the way of saving the stock: any trouble is logged and
// left, and the stock save has already succeeded.
export function announceWantedArrivals(dealershipId: string): void {
  try {
    const stored = readRequests(dealershipId);
    if (stored.length === 0) return;

    const plan = planArrivals(withoutExpired(stored), publicVehiclesFor(dealershipId));
    if (!plan.changed) return;
    writeTenantCollection(dealershipId, COLLECTION, plan.requests);
    if (plan.arrivals.length === 0) return;

    const now = new Date().toISOString();
    const notices = arrivalNotices(plan.arrivals);
    const fresh = staffWhoSell(dealershipId).flatMap(staff =>
      notices.map(n => ({ id: randomUUID(), userId: staff.id, title: n.title, message: n.message, type: "info" as const, createdAt: now, readAt: null }))
    );
    if (fresh.length === 0) return;
    const notifications = readTenantCollection<unknown>(dealershipId, "notifications");
    writeTenantCollection(dealershipId, "notifications", [...notifications, ...fresh]);
  } catch (err) {
    console.error("announceWantedArrivals: could not check waiting customers against the stock", err);
  }
}

export default function registerWantedRoute(app: Express) {
  // What the form needs before it can be shown: the exact words the person is
  // agreeing to. No wording, no form.
  app.get("/public/:dealershipId/wanted", wantedReadLimiter, (req, res) => {
    const dealershipId = req.params.dealershipId;
    if (!sane(dealershipId)) return res.status(404).json({ ok: false, error: "Dealership not found" });
    const dealership = readCollection<Dealership>("dealerships").find(d => d.id === dealershipId);
    if (!dealership) return res.status(404).json({ ok: false, error: "Dealership not found" });

    const live = withoutExpired(readRequests(dealershipId));
    res.json({
      ok: true,
      consentWording: consentWording(dealership.name),
      accepting: live.length < MAX_LIVE_REQUESTS,
    });
  });

  app.post("/public/:dealershipId/wanted", wantedWriteLimiter, (req, res) => {
    const dealershipId = req.params.dealershipId;
    if (!sane(dealershipId)) return res.status(404).json({ ok: false, error: "Dealership not found" });
    const dealership = readCollection<Dealership>("dealerships").find(d => d.id === dealershipId);
    if (!dealership) return res.status(404).json({ ok: false, error: "Dealership not found" });

    // A box real people never see. Anything typed into it is a script, which is
    // told it worked and gets nothing kept.
    const trap = (req.body as { website?: unknown } | undefined)?.website;
    if (typeof trap === "string" && trap.trim() !== "") return res.json({ ok: true, inStockNow: [] });

    const parsed = parseWantedInput(req.body);
    if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });
    const input = parsed.value;

    const now = new Date().toISOString();
    const live = withoutExpired(readRequests(dealershipId));
    const repeat = findRepeat(live, input);

    // What already fits is what the customer is shown below, and is not news to
    // the team later: it is recorded as announced so it never is.
    const inStock = publicVehiclesFor(dealershipId);
    const fits = matchesFor(input, inStock).filter(m => m.overBudgetBy === undefined);
    const fitIds = fits.map(m => m.vehicleId);

    let created: WantedRequest | undefined;
    let next: WantedRequest[];
    if (repeat) {
      // The same person asking again for the same car: keep one request, with
      // their latest wording, and start its retention period afresh.
      next = live.map(r =>
        r.id !== repeat.id
          ? r
          : {
              ...r,
              name: input.name,
              ...(input.maxPrice !== undefined ? { maxPrice: input.maxPrice } : {}),
              ...(input.note !== undefined ? { note: input.note } : {}),
              ...(input.phone !== undefined ? { phone: input.phone } : {}),
              ...(input.email !== undefined ? { email: input.email } : {}),
              consent: { at: now, wording: consentWording(dealership.name) },
              askedAt: now,
              announcedVehicleIds: [...new Set([...(r.announcedVehicleIds ?? []), ...fitIds])].slice(-MAX_ANNOUNCED_PER_REQUEST),
            }
      );
    } else {
      if (live.length >= MAX_LIVE_REQUESTS) {
        return res.status(503).json({ ok: false, error: "This dealership can't take any more requests just now. Please call them instead." });
      }
      created = {
        id: randomUUID(),
        ...input,
        status: "waiting",
        consent: { at: now, wording: consentWording(dealership.name) },
        createdAt: now,
        askedAt: now,
        announcedVehicleIds: fitIds.slice(-MAX_ANNOUNCED_PER_REQUEST),
      };
      next = [...live, created];
    }
    writeTenantCollection(dealershipId, COLLECTION, next);

    const inStockNow = fits
      .slice(0, MAX_SHOWN_TO_CUSTOMER)
      .map(m => inStock.find(v => v.id === m.vehicleId))
      .filter((v): v is NonNullable<typeof v> => v !== undefined);

    // Tell the people who would act on it, but only once per request, and never
    // who is asking: that is one click away on the Wanted page.
    if (created) {
      const staffToNotify = staffWhoSell(dealershipId);
      const notifications = readTenantCollection<unknown>(dealershipId, "notifications");
      const title = fits.length > 0 ? "Someone wants a car you have in stock" : "Someone is looking for a car";
      const fresh = staffToNotify.map(staff => ({
        id: randomUUID(),
        userId: staff.id,
        title,
        message: wantedSummary(input),
        type: "info" as const,
        createdAt: now,
        readAt: null,
      }));
      writeTenantCollection(dealershipId, "notifications", [...notifications, ...fresh]);
    }

    res.json({ ok: true, inStockNow });
  });

  // ---- the dealer's side. Names and phone numbers, so sales, managers and the
  // owner only (a valet or a bookkeeper has no need of them).

  app.get("/wanted", requireStaffRole("sales", "manager"), (req, res) => {
    const dealershipId = authUser(req).dealershipId;
    const stock = publicVehiclesFor(dealershipId);
    const items: WantedForStaff[] = withoutExpired(readRequests(dealershipId)).map(({ announcedVehicleIds: _kept, ...r }) => ({ ...r, matches: matchesFor(r, stock) }));
    res.json({ ok: true, items: orderForStaff(items), retentionDays: RETENTION_DAYS });
  });

  app.put("/wanted/:id", requireStaffRole("sales", "manager"), (req, res) => {
    const dealershipId = authUser(req).dealershipId;
    const id = req.params.id;
    const status = (req.body as { status?: unknown } | undefined)?.status;
    if (!WANTED_STATUSES.includes(status as WantedStatus)) {
      return res.status(400).json({ ok: false, error: "Status must be waiting, contacted or closed." });
    }
    const live = withoutExpired(readRequests(dealershipId));
    const target = live.find(r => r.id === id);
    if (!target) return res.status(404).json({ ok: false, error: "That request is no longer on the list." });

    const changedAt = new Date().toISOString();
    const updated: WantedRequest = { ...target, status: status as WantedStatus, statusChangedAt: changedAt };
    writeTenantCollection(dealershipId, COLLECTION, live.map(r => (r.id === id ? updated : r)));
    res.json({ ok: true, item: updated });
  });

  // Forgetting someone entirely, for when they ask, or when it is simply done with.
  app.delete("/wanted/:id", requireStaffRole("sales", "manager"), (req, res) => {
    const dealershipId = authUser(req).dealershipId;
    const id = req.params.id;
    const live = withoutExpired(readRequests(dealershipId));
    if (!live.some(r => r.id === id)) return res.status(404).json({ ok: false, error: "That request is no longer on the list." });
    writeTenantCollection(dealershipId, COLLECTION, live.filter(r => r.id !== id));
    res.json({ ok: true });
  });
}
