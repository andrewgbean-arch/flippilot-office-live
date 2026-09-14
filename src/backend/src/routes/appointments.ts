import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";
import type { Appointment, AppointmentStatus } from "./publicBooking";

function dealershipId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.dealershipId;
}

// Staff-side view of appointments the public booking form creates.
// Deliberately open to any authenticated staff to confirm/decline/
// reschedule — handling a customer viewing request is a sales-floor
// task, not gated the way staff/bookkeeping writes are.
export default function registerAppointmentsRoute(app: Express) {
  app.get("/appointments", (req, res) => {
    res.json({ ok: true, items: readTenantCollection<Appointment>(dealershipId(req), "appointments") });
  });

  // A single edit endpoint rather than a status-only one — a customer's
  // requested slot often doesn't work and the dealer needs to confirm
  // a DIFFERENT time, not just accept-as-is or decline outright. Every
  // field is optional so a plain "just change the status" call (the
  // original shape) still works unchanged.
  app.put("/appointments/:id", (req, res) => {
    const { status, requestedDate, requestedTime, notes } = req.body ?? {};

    if (status !== undefined && !["pending", "confirmed", "declined", "completed"].includes(status)) {
      return res.status(400).json({ ok: false, error: "Invalid status" });
    }
    if (requestedDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      return res.status(400).json({ ok: false, error: "Invalid requestedDate" });
    }
    if (requestedTime !== undefined && !/^\d{2}:\d{2}$/.test(requestedTime)) {
      return res.status(400).json({ ok: false, error: "Invalid requestedTime" });
    }

    const items = readTenantCollection<Appointment>(dealershipId(req), "appointments");
    if (!items.some(a => a.id === req.params.id)) {
      return res.status(404).json({ ok: false, error: "Appointment not found" });
    }

    const updated = items.map(a => {
      if (a.id !== req.params.id) return a;
      return {
        ...a,
        ...(status !== undefined ? { status: status as AppointmentStatus } : {}),
        ...(requestedDate !== undefined ? { requestedDate } : {}),
        ...(requestedTime !== undefined ? { requestedTime } : {}),
        ...(typeof notes === "string" ? { notes: notes.trim() || undefined } : {}),
      };
    });
    writeTenantCollection(dealershipId(req), "appointments", updated);
    res.json({ ok: true, items: updated });
  });
}
