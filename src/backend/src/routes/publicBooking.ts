import { randomUUID } from "crypto";
import { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { readCollection, readTenantCollection, writeTenantCollection } from "../db";
import type { StoredUser, Dealership } from "../auth";

export type AppointmentType = "viewing" | "test_drive";
export type AppointmentStatus = "pending" | "confirmed" | "declined" | "completed";

export interface Appointment {
  id: string;
  vehicleId: string;
  vehicleLabel: string;
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

  app.post("/public/:dealershipId/appointments", bookingLimiter, (req, res) => {
    const dealershipId = req.params.dealershipId;
    if (!dealershipId) return res.status(400).json({ ok: false, error: "Missing dealership id" });

    const dealership = findDealership(dealershipId);
    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }

    const { vehicleId, customerName, customerPhone, customerEmail, type, requestedDate, requestedTime, notes } =
      req.body ?? {};

    if (
      typeof vehicleId !== "string" ||
      typeof customerName !== "string" ||
      !customerName.trim() ||
      (type !== "viewing" && type !== "test_drive") ||
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

    const vehicles = readTenantCollection<any>(dealershipId, "vehicles");
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
      return res.status(400).json({ ok: false, error: "That vehicle is no longer available" });
    }
    const vehicleLabel = `${vehicle.reg ? vehicle.reg + " — " : ""}${vehicle.make} ${vehicle.model}`;

    // Match an existing lead by phone or email before creating a new
    // one — a returning customer booking a second viewing shouldn't
    // fork into a duplicate CRM record.
    const leads = readTenantCollection<any>(dealershipId, "leads");
    let lead = leads.find(
      l => (customerEmail && l.email === customerEmail) || (customerPhone && l.phone === customerPhone)
    );
    const leadStatus = type === "test_drive" ? "test_drive" : "viewing_booked";
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
      vehicleId,
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
    const newNotifications = staffToNotify.map(staff => ({
      id: randomUUID(),
      userId: staff.id,
      title: `New ${type === "test_drive" ? "test drive" : "viewing"} request`,
      message: `${customerName.trim()} — ${vehicleLabel} — ${requestedDate} ${requestedTime}`,
      type: "info" as const,
      createdAt: new Date().toISOString(),
      readAt: null,
    }));
    writeTenantCollection(dealershipId, "notifications", [...notifications, ...newNotifications]);

    res.json({ ok: true, appointment });
  });
}
