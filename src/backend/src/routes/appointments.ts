import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";
import type { Appointment, AppointmentStatus, AppointmentOutcome } from "./publicBooking";

const VALID_OUTCOMES: AppointmentOutcome[] = ["showed", "purchased", "no_show"];

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
  //
  // `outcome` records what actually happened once it's taken place
  // (showed / purchased / no_show) and closes the appointment as
  // completed in the same step. It's only valid on an appointment that's
  // confirmed or already completed (a pending or declined request never
  // happened), and an MOT booking can't be "purchased" — it's the
  // customer's own car, not one the dealer sold them.
  app.put("/appointments/:id", (req, res) => {
    const { status, requestedDate, requestedTime, notes, outcome } = req.body ?? {};

    if (status !== undefined && !["pending", "confirmed", "declined", "completed"].includes(status)) {
      return res.status(400).json({ ok: false, error: "Invalid status" });
    }
    if (outcome !== undefined && !VALID_OUTCOMES.includes(outcome)) {
      return res.status(400).json({ ok: false, error: "Invalid outcome" });
    }
    if (outcome !== undefined && status !== undefined && status !== "completed") {
      return res.status(400).json({
        ok: false,
        error: "Recording an outcome closes the appointment as completed — don't also set a different status",
      });
    }
    if (requestedDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      return res.status(400).json({ ok: false, error: "Invalid requestedDate" });
    }
    if (requestedTime !== undefined && !/^\d{2}:\d{2}$/.test(requestedTime)) {
      return res.status(400).json({ ok: false, error: "Invalid requestedTime" });
    }

    const items = readTenantCollection<Appointment>(dealershipId(req), "appointments");
    const target = items.find(a => a.id === req.params.id);
    if (!target) {
      return res.status(404).json({ ok: false, error: "Appointment not found" });
    }

    if (outcome !== undefined) {
      if (target.status !== "confirmed" && target.status !== "completed") {
        return res
          .status(400)
          .json({ ok: false, error: "Only a confirmed or completed appointment can have an outcome" });
      }
      if (outcome === "purchased" && target.type === "mot") {
        return res.status(400).json({ ok: false, error: "An MOT booking can't be marked as purchased" });
      }
    }

    const updated = items.map(a => {
      if (a.id !== req.params.id) return a;
      const next = {
        ...a,
        ...(status !== undefined ? { status: status as AppointmentStatus } : {}),
        ...(requestedDate !== undefined ? { requestedDate } : {}),
        ...(requestedTime !== undefined ? { requestedTime } : {}),
        ...(typeof notes === "string" ? { notes: notes.trim() || undefined } : {}),
      };
      if (outcome !== undefined) {
        next.status = "completed";
        next.outcome = outcome as AppointmentOutcome;
        next.outcomeAt = new Date().toISOString();
      } else if (status !== undefined && status !== "completed") {
        // An outcome only means something on a completed appointment —
        // if it's being moved back to pending/confirmed/declined, drop
        // it rather than leave a "no-show" hanging on a live booking.
        delete next.outcome;
        delete next.outcomeAt;
      }
      return next;
    });
    writeTenantCollection(dealershipId(req), "appointments", updated);
    res.json({ ok: true, items: updated });
  });
}
