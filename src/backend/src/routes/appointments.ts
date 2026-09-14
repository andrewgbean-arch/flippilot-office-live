import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";
import type { Appointment, AppointmentStatus } from "./publicBooking";

function dealershipId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.dealershipId;
}

// Staff-side view of appointments the public booking form creates.
// Deliberately open to any authenticated staff to confirm/decline —
// handling a customer viewing request is a sales-floor task, not
// gated the way staff/bookkeeping writes are.
export default function registerAppointmentsRoute(app: Express) {
  app.get("/appointments", (req, res) => {
    res.json({ ok: true, items: readTenantCollection<Appointment>(dealershipId(req), "appointments") });
  });

  app.put("/appointments/:id/status", (req, res) => {
    const { status } = req.body ?? {};
    if (!["confirmed", "declined", "completed"].includes(status)) {
      return res.status(400).json({ ok: false, error: "status must be confirmed, declined or completed" });
    }

    const items = readTenantCollection<Appointment>(dealershipId(req), "appointments");
    if (!items.some(a => a.id === req.params.id)) {
      return res.status(404).json({ ok: false, error: "Appointment not found" });
    }

    const updated = items.map(a =>
      a.id === req.params.id ? { ...a, status: status as AppointmentStatus } : a
    );
    writeTenantCollection(dealershipId(req), "appointments", updated);
    res.json({ ok: true, items: updated });
  });
}
