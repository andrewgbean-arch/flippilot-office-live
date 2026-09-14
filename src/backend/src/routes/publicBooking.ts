import { randomUUID } from "crypto";
import { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { readCollection, readTenantCollection, writeTenantCollection, readTenantDoc } from "../db";
import type { StoredUser, Dealership } from "../auth";
import { DEFAULT_BOOKING_SETTINGS, type BookingSettings, type WeekDay } from "./bookingSettings";

export type AppointmentType = "viewing" | "test_drive" | "mot";
export type AppointmentStatus = "pending" | "confirmed" | "declined" | "completed";

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
  notes?: string;
  leadId?: string;
  createdAt: string;
}

interface PublicVehicle {
  id: string;
  reg?: string;
  make: string;
  model: string;
  year: number | null;
  mileage: number | null;
  colour?: string;
  priceRetail: number | null;
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
  return WEEKDAY_BY_GETDAY[new Date(y, m - 1, d).getDay()] ?? null;
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
  app.get("/public/:dealershipId/info", (req, res) => {
    const dealershipId = req.params.dealershipId;
    if (!dealershipId) return res.status(400).json({ ok: false, error: "Missing dealership id" });

    const dealership = findDealership(dealershipId);
    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }
    // Only what a public page needs to render — never phone/address/
    // subscription/billing fields from the same record.
    res.json({ ok: true, name: dealership.name });
  });

  app.get("/public/:dealershipId/vehicles", (req, res) => {
    const dealershipId = req.params.dealershipId;
    if (!dealershipId) return res.status(400).json({ ok: false, error: "Missing dealership id" });

    const dealership = findDealership(dealershipId);
    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }

    const vehicles = readTenantCollection<any>(dealershipId, "vehicles");
    const publicVehicles: PublicVehicle[] = vehicles.map(v => ({
      id: v.id,
      ...(v.reg ? { reg: v.reg } : {}),
      make: v.make,
      model: v.model,
      year: v.year ?? null,
      mileage: v.mileage ?? null,
      ...(v.colour ? { colour: v.colour } : {}),
      priceRetail: v.priceRetail ?? v.sellPrice ?? null,
    }));
    res.json({ ok: true, items: publicVehicles });
  });

  app.get("/public/:dealershipId/booking-settings", (req, res) => {
    const dealershipId = req.params.dealershipId;
    if (!dealershipId) return res.status(400).json({ ok: false, error: "Missing dealership id" });

    const dealership = findDealership(dealershipId);
    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }
    res.json({ ok: true, settings: readTenantDoc<BookingSettings>(dealershipId, "bookingSettings", DEFAULT_BOOKING_SETTINGS) });
  });

  app.get("/public/:dealershipId/available-slots", (req, res) => {
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

    const { vehicleId, customerVehicleReg, customerName, customerPhone, customerEmail, type, requestedDate, requestedTime, notes } =
      req.body ?? {};

    if (
      typeof customerName !== "string" ||
      !customerName.trim() ||
      (type !== "viewing" && type !== "test_drive" && type !== "mot") ||
      typeof requestedDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ||
      typeof requestedTime !== "string" ||
      !/^\d{2}:\d{2}$/.test(requestedTime)
    ) {
      return res.status(400).json({ ok: false, error: "Missing or invalid booking details" });
    }
    if (!customerPhone && !customerEmail) {
      return res.status(400).json({ ok: false, error: "A phone number or email is required so we can confirm the booking" });
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
    const leadStatus = type === "test_drive" ? "test_drive" : type === "mot" ? "mot_booked" : "viewing_booked";
    if (lead) {
      lead.status = leadStatus;
      lead.vehicleInterest = vehicleLabel;
    } else {
      lead = {
        id: randomUUID(),
        name: customerName.trim(),
        ...(customerPhone ? { phone: customerPhone } : {}),
        ...(customerEmail ? { email: customerEmail } : {}),
        source: "Website Booking",
        vehicleInterest: vehicleLabel,
        status: leadStatus,
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
      customerName: customerName.trim(),
      ...(customerPhone ? { customerPhone } : {}),
      ...(customerEmail ? { customerEmail } : {}),
      type,
      requestedDate,
      requestedTime,
      status: "pending",
      ...(typeof notes === "string" && notes.trim() ? { notes: notes.trim() } : {}),
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
      message: `${customerName.trim()} — ${vehicleLabel} — ${requestedDate} ${requestedTime}`,
      type: "info" as const,
      createdAt: new Date().toISOString(),
      readAt: null,
    }));
    writeTenantCollection(dealershipId, "notifications", [...notifications, ...newNotifications]);

    res.json({ ok: true, appointment });
  });
}
