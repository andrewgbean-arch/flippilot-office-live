import { randomUUID } from "crypto";
import { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { readCollection, readTenantCollection, writeTenantCollection, readTenantDoc } from "../db";
import type { StoredUser, Dealership } from "../auth";
import { isSampleVehicleId } from "../sampleVehicles";
import { publishedVehicleIds } from "./carPassport";
import { bookedStatus, leadUpdateForBooking } from "../engines/leadBookingStatus";
import { DEFAULT_BOOKING_SETTINGS, type BookingSettings, type WeekDay } from "./bookingSettings";
import { toSingleLine, toMultiLine } from "../untrustedText";

export type AppointmentType = "viewing" | "test_drive" | "mot";
export type AppointmentStatus = "pending" | "confirmed" | "declined" | "completed";
// What actually happened at an appointment — recorded by staff once it's
// taken place. "completed" alone only says it's closed out; without this
// there's no way to tell a customer who turned up and bought from one
// who never came.
export type AppointmentOutcome = "showed" | "purchased" | "no_show";

export interface Appointment {
  id: string;
  // Only set for "viewing"/"test_drive" — a real vehicle from this
  // dealership's own stock. An "mot" booking is the CUSTOMER's own car
  // coming in for a test, not a car the dealer is selling, so it has
  // no vehicleId at all — see customerVehicleReg instead.
  vehicleId?: string;
  vehicleLabel: string;
  customerVehicleReg?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  type: AppointmentType;
  requestedDate: string;
  requestedTime: string;
  status: AppointmentStatus;
  // Only ever set on a completed appointment (see PUT /appointments/:id).
  outcome?: AppointmentOutcome;
  outcomeAt?: string;
  notes?: string;
  leadId?: string;
  createdAt: string;
}

interface PublicVehicle {
  id: string;
  // True when the dealer has published this car's Car Passport page.
  hasPassport?: boolean;
  reg?: string;
  make: string;
  model: string;
  year: number | null;
  mileage: number | null;
  colour?: string;
  priceRetail: number | null;
}

// The price a stranger is shown is the ASKING price the dealer has set (priceRetail)
// and nothing else. This used to fall back to `sellPrice`, but sellPrice is written
// once when a car is created and is only the real sale price after a sale: clearing
// the Retail Price on Edit Vehicle left it behind, so the price the dealer had just
// taken off (and the app now shows as "Not set") went on being advertised to the
// public. An unpriced car, or one with a stored 0, has no public price at all, and
// the store page then says "Price on request".
export function publicAskingPrice(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

// No API-key/login gate exists here at all — this is the one part of
// the whole app a stranger on the internet can reach with no account.
// Rate-limited hard (30 submissions per hour per IP is generous for a
// real customer filling in one form, but blocks a script hammering it)
// since the alternative to limiting it is trusting arbitrary internet
// traffic to write real data with no cost at all.
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 500 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many booking requests — please try again later." },
});

// The GET routes below (info/vehicles/booking-settings/available-slots)
// are also unauthenticated by the same design — the booking widget is
// meant to be embedded on a dealer's own public website. But unlike
// the write path above, they had no limiter at all, so once a widget
// URL is known (which is the point — it's public), a scraper could
// poll a dealer's live stock/pricing at unlimited rate. Generous
// enough that a real visitor loading the page and flipping through a
// few dates never notices it.
const publicReadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests — please try again shortly." },
});

// What a stranger may type into the booking form is stored, shown to staff and
// (the name) read by Pilot Brain, so every free-text field has a limit and is
// cleaned before it is kept — see untrustedText.ts.
const MAX_NAME_CHARS = 80;
const MAX_NOTES_CHARS = 500;
const MAX_EMAIL_CHARS = 254; // the longest an email address can legitimately be
const MAX_PHONE_CHARS = 40; // room for a mobile and a landline, or a number with an extension

// One address: something, one "@", something. Neither side may hold a space or
// a character that means something in a mailto: link or a web address (? & = %
// # /), so a stored address can never add a cc, a bcc or a subject to the email
// staff send from the "Email Customer" button, or carry a %-escape. Apostrophes
// (O'Brien@example.co.uk is a real address), plus-addressing, dots, hyphens and
// letters of any alphabet are all fine.
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"?&=%#\/]+@[^\s@<>()[\]\\,;:"?&=%#\/]+$/;

// What people type into a contact box they would rather leave empty. It counts
// as nothing at all, so one placeholder cannot lose a booking that has a good
// phone number or email (a booking still needs at least one of the two).
const PLACEHOLDER_CONTACT = /^(?:(?:n\/?a|n\.a|not applicable|none|nil|no|no e-?mail|no phone|x+)\.?|[-?.]+)$/i;

// What the customer is told, on the booking page, when a contact detail is refused.
const PHONE_ADVICE = `Please give one phone number (at least 5 digits, up to ${MAX_PHONE_CHARS} characters), or leave it blank and give an email instead.`;
const EMAIL_ADVICE = "Please give one email address in the form name@example.com, or leave it blank and give a phone number instead.";

// What a contact box came to: a cleaned value, nothing at all (not given, or
// only a placeholder), or something refused, with the advice to show the customer.
type Contact = { value: string | undefined } | { refused: string };

// undefined: nothing usable given. null: not text, or too long. Otherwise the tidied text.
function readContact(raw: unknown, max: number): string | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return null;
  // Tidied with a limit far above `max`, so that nothing is cut off here: the
  // length is judged on all of what was typed. (Cutting first and measuring
  // after let a value slip through, or lose its second half, depending on
  // where a space fell.)
  const value = toSingleLine(raw, max * 4);
  if (!value || PLACEHOLDER_CONTACT.test(value)) return undefined;
  return Array.from(value).length > max ? null : value;
}

function cleanEmail(raw: unknown): Contact {
  const value = readContact(raw, MAX_EMAIL_CHARS);
  if (value === undefined) return { value: undefined };
  return value !== null && EMAIL_PATTERN.test(value) ? { value } : { refused: EMAIL_ADVICE };
}

function cleanPhone(raw: unknown): Contact {
  const value = readContact(raw, MAX_PHONE_CHARS);
  if (value === undefined) return { value: undefined };
  return value !== null && (value.match(/\d/g) ?? []).length >= 5 ? { value } : { refused: PHONE_ADVICE };
}

// Today's date (yyyy-mm-dd) on a clock in the UK, where these dealers trade —
// a booking is "in the past" by UK dates, not by the server's own time zone.
export function londonToday(now: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function findDealership(dealershipId: string): Dealership | undefined {
  return readCollection<Dealership>("dealerships").find(d => d.id === dealershipId);
}

const WEEKDAY_BY_GETDAY: WeekDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Built from the y/m/d components directly rather than parsing the
// string or round-tripping through toISOString() — see this session's
// rota planner work for the exact UTC-rollback bug that pattern causes
// under a positive timezone offset (true for the UK under BST).
function weekdayFor(dateStr: string): WeekDay | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const day = new Date(y, m - 1, d);
  // 2026-02-30 or 2026-13-01 would quietly roll over into some other date.
  if (day.getFullYear() !== y || day.getMonth() !== m - 1 || day.getDate() !== d) return null;
  return WEEKDAY_BY_GETDAY[day.getDay()] ?? null;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = Math.round(mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// The full set of slot start times within opening hours — callers
// filter out ones already booked. A closed day returns no slots at
// all rather than a day's worth of times nobody can actually take.
function allSlotsFor(settings: BookingSettings, weekday: WeekDay): string[] {
  if (!settings.openDays.includes(weekday)) return [];
  const slots: string[] = [];
  const end = toMinutes(settings.closeTime);
  for (let mins = toMinutes(settings.openTime); mins + settings.slotMinutes <= end; mins += settings.slotMinutes) {
    slots.push(toHHMM(mins));
  }
  return slots;
}

function availableSlotsFor(dealershipId: string, date: string): string[] {
  const weekday = weekdayFor(date);
  if (!weekday) return [];
  if (date < londonToday()) return []; // a day that has already gone has no times left to offer
  const settings = readTenantDoc<BookingSettings>(dealershipId, "bookingSettings", DEFAULT_BOOKING_SETTINGS);
  if (settings.closedDates?.includes(date)) return [];
  const all = allSlotsFor(settings, weekday);
  if (all.length === 0) return [];

  const appointments = readTenantCollection<Appointment>(dealershipId, "appointments");
  const taken = new Set(
    appointments.filter(a => a.requestedDate === date && a.status !== "declined").map(a => a.requestedTime)
  );
  return all.filter(s => !taken.has(s));
}

export default function registerPublicBookingRoute(app: Express) {
  app.get("/public/:dealershipId/info", publicReadLimiter, (req, res) => {
    const dealershipId = req.params.dealershipId;
    if (!dealershipId) return res.status(400).json({ ok: false, error: "Missing dealership id" });

    const dealership = findDealership(dealershipId);
    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }
    // Phone/address are genuinely public now that this also backs a
    // real public dealer page (a customer needs to be able to find and
    // call the place) — but subscription/billing/owner fields from the
    // same record never leave this endpoint.
    res.json({
      ok: true,
      name: dealership.name,
      ...(dealership.phone ? { phone: dealership.phone } : {}),
      ...(dealership.address ? { address: dealership.address } : {}),
    });
  });

  app.get("/public/:dealershipId/vehicles", publicReadLimiter, (req, res) => {
    const dealershipId = req.params.dealershipId;
    if (!dealershipId) return res.status(400).json({ ok: false, error: "Missing dealership id" });

    const dealership = findDealership(dealershipId);
    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }

    // This response used to feed only the internal booking-widget's
    // vehicle picker (a logged-in-adjacent context where a sold car
    // briefly still appearing was low-stakes). It now also drives
    // PublicDealerPage.tsx's "Vehicles For Sale" grid on the genuinely
    // public /store/:dealershipId page — showing an anonymous visitor
    // a car that's already sold is a real, visible mistake there, not
    // a cosmetic one.
    const vehicles = readTenantCollection<any>(dealershipId, "vehicles")
      .filter(v => String(v.status ?? "").toLowerCase() !== "sold")
      .filter(v => !isSampleVehicleId(v.id));
    const passports = publishedVehicleIds(dealershipId);
    const publicVehicles: PublicVehicle[] = vehicles.map(v => ({
      id: v.id,
      ...(passports.has(v.id) ? { hasPassport: true } : {}),
      ...(v.reg ? { reg: v.reg } : {}),
      make: v.make,
      model: v.model,
      year: v.year ?? null,
      mileage: v.mileage ?? null,
      ...(v.colour ? { colour: v.colour } : {}),
      priceRetail: publicAskingPrice(v.priceRetail),
    }));
    res.json({ ok: true, items: publicVehicles });
  });

  app.get("/public/:dealershipId/booking-settings", publicReadLimiter, (req, res) => {
    const dealershipId = req.params.dealershipId;
    if (!dealershipId) return res.status(400).json({ ok: false, error: "Missing dealership id" });

    const dealership = findDealership(dealershipId);
    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }
    res.json({ ok: true, settings: readTenantDoc<BookingSettings>(dealershipId, "bookingSettings", DEFAULT_BOOKING_SETTINGS) });
  });

  app.get("/public/:dealershipId/available-slots", publicReadLimiter, (req, res) => {
    const dealershipId = req.params.dealershipId;
    if (!dealershipId) return res.status(400).json({ ok: false, error: "Missing dealership id" });

    const dealership = findDealership(dealershipId);
    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }

    const date = req.query.date;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: "date (yyyy-mm-dd) query param is required" });
    }

    res.json({ ok: true, slots: availableSlotsFor(dealershipId, date) });
  });

  app.post("/public/:dealershipId/appointments", bookingLimiter, (req, res) => {
    const dealershipId = req.params.dealershipId;
    if (!dealershipId) return res.status(400).json({ ok: false, error: "Missing dealership id" });

    const dealership = findDealership(dealershipId);
    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }

    const { vehicleId, customerVehicleReg, customerName: rawName, customerPhone: rawPhone, customerEmail: rawEmail, type, requestedDate, requestedTime, notes: rawNotes } =
      req.body ?? {};

    // Every free-text field is cleaned and capped before it is used or kept:
    // this route is open to the whole internet and what is typed here is later
    // shown to staff and read by Pilot Brain.
    const customerName = toSingleLine(rawName, MAX_NAME_CHARS);
    const phone = cleanPhone(rawPhone);
    const email = cleanEmail(rawEmail);
    const notes = toMultiLine(rawNotes, MAX_NOTES_CHARS);

    if (
      !customerName ||
      (type !== "viewing" && type !== "test_drive" && type !== "mot") ||
      typeof requestedDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ||
      typeof requestedTime !== "string" ||
      !/^\d{2}:\d{2}$/.test(requestedTime)
    ) {
      return res.status(400).json({ ok: false, error: "Missing or invalid booking details" });
    }
    if ("refused" in phone) {
      return res.status(400).json({ ok: false, error: phone.refused });
    }
    if ("refused" in email) {
      return res.status(400).json({ ok: false, error: email.refused });
    }
    const customerPhone = phone.value;
    const customerEmail = email.value;
    if (!customerPhone && !customerEmail) {
      return res.status(400).json({ ok: false, error: "Please give a phone number or email so we can confirm the booking." });
    }
    if (weekdayFor(requestedDate) === null) {
      return res.status(400).json({ ok: false, error: "That doesn't look like a real date" });
    }
    if (requestedDate < londonToday()) {
      return res.status(400).json({ ok: false, error: "That date has already passed — please choose today or a later date." });
    }

    // An MOT booking is the customer's OWN car, not a vehicle from this
    // dealership's stock — a different field, and deliberately not
    // looked up against DVSA here (that endpoint requires a real login
    // specifically so a stranger can't spend the dealer's own API
    // quota for free; staff can verify the reg themselves when they
    // review the booking, via the existing internal MOT Lookup tool).
    let vehicleId_: string | undefined;
    let vehicleLabel: string;
    let normalisedCustomerReg: string | undefined;

    if (type === "mot") {
      if (typeof customerVehicleReg !== "string" || !customerVehicleReg.trim()) {
        return res.status(400).json({ ok: false, error: "Your vehicle registration is required for an MOT booking" });
      }
      normalisedCustomerReg = customerVehicleReg.trim().toUpperCase().replace(/\s+/g, "");
      if (!/^[A-Z0-9]{1,7}$/.test(normalisedCustomerReg)) {
        return res.status(400).json({ ok: false, error: "That doesn't look like a valid registration" });
      }
      vehicleLabel = normalisedCustomerReg;
    } else {
      if (typeof vehicleId !== "string") {
        return res.status(400).json({ ok: false, error: "Missing or invalid booking details" });
      }
      const vehicles = readTenantCollection<any>(dealershipId, "vehicles");
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (!vehicle) {
        return res.status(400).json({ ok: false, error: "That vehicle is no longer available" });
      }
      vehicleId_ = vehicleId;
      vehicleLabel = `${vehicle.reg ? vehicle.reg + " — " : ""}${vehicle.make} ${vehicle.model}`;
    }

    // Re-checked server-side, not just trusted from whatever the page
    // showed when the customer loaded it — a slot can go stale between
    // loading the form and submitting (someone else booked it, or it's
    // simply outside opening hours/a closed day for this dealership).
    if (!availableSlotsFor(dealershipId, requestedDate).includes(requestedTime)) {
      return res.status(409).json({ ok: false, error: "That time is no longer available — please choose another." });
    }

    // Match an existing lead by phone or email before creating a new
    // one — a returning customer booking a second viewing shouldn't
    // fork into a duplicate CRM record.
    const leads = readTenantCollection<any>(dealershipId, "leads");
    let lead = leads.find(
      l => (customerEmail && l.email === customerEmail) || (customerPhone && l.phone === customerPhone)
    );
    if (lead) {
      // Never wipes a win or drags a lead backwards — see leadBookingStatus.
      const update = leadUpdateForBooking(lead.status, type);
      if (update.status !== (lead.status ?? "")) lead.status = update.status;
      if (update.updateInterest) lead.vehicleInterest = vehicleLabel;
    } else {
      lead = {
        id: randomUUID(),
        name: customerName,
        ...(customerPhone ? { phone: customerPhone } : {}),
        ...(customerEmail ? { email: customerEmail } : {}),
        source: "Website Booking",
        vehicleInterest: vehicleLabel,
        status: bookedStatus(type),
        createdAt: new Date().toISOString(),
      };
      leads.push(lead);
    }
    writeTenantCollection(dealershipId, "leads", leads);

    const appointments = readTenantCollection<Appointment>(dealershipId, "appointments");
    const appointment: Appointment = {
      id: randomUUID(),
      ...(vehicleId_ ? { vehicleId: vehicleId_ } : {}),
      ...(normalisedCustomerReg ? { customerVehicleReg: normalisedCustomerReg } : {}),
      vehicleLabel,
      customerName,
      ...(customerPhone ? { customerPhone } : {}),
      ...(customerEmail ? { customerEmail } : {}),
      type,
      requestedDate,
      requestedTime,
      status: "pending",
      ...(notes ? { notes } : {}),
      leadId: lead.id,
      createdAt: new Date().toISOString(),
    };
    writeTenantCollection(dealershipId, "appointments", [...appointments, appointment]);

    // Real cross-account delivery (same mechanism the rota planner
    // uses) to whoever would actually handle this — the owner and any
    // manager/sales account — rather than a booking silently sitting
    // unseen until someone happens to open the Appointments page.
    const staffToNotify = readCollection<StoredUser>("users").filter(
      u => u.dealershipId === dealershipId && (u.role === "owner" || u.staffRole === "manager" || u.staffRole === "sales")
    );
    const notifications = readTenantCollection<any>(dealershipId, "notifications");
    const typeLabel = type === "test_drive" ? "test drive" : type === "mot" ? "MOT" : "viewing";
    const newNotifications = staffToNotify.map(staff => ({
      id: randomUUID(),
      userId: staff.id,
      title: `New ${typeLabel} request`,
      message: `${customerName} — ${vehicleLabel} — ${requestedDate} ${requestedTime}`,
      type: "info" as const,
      createdAt: new Date().toISOString(),
      readAt: null,
    }));
    writeTenantCollection(dealershipId, "notifications", [...notifications, ...newNotifications]);

    res.json({ ok: true, appointment });
  });
}
