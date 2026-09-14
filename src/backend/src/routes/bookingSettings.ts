import { Express, Request } from "express";
import { readTenantDoc, writeTenantDoc } from "../db";
import { requireStaffRole, type AuthUser } from "../auth";

export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface BookingSettings {
  openDays: WeekDay[];
  openTime: string;
  closeTime: string;
  // How long one viewing/test drive is assumed to take — the unit the
  // public page's available slots are generated in.
  slotMinutes: number;
  // One-off closures (bank holidays, a short-staffed day) that override
  // openDays for that specific date, even on an otherwise-open weekday.
  // yyyy-mm-dd strings.
  closedDates: string[];
}

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  openDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
  openTime: "09:00",
  closeTime: "18:00",
  slotMinutes: 30,
  closedDates: [],
};

function dealershipId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.dealershipId;
}

// The dealer's own side of configuring which days/times the public
// booking page offers — see publicBooking.ts for where a customer's
// available slots actually get computed from this.
export default function registerBookingSettingsRoute(app: Express) {
  app.get("/booking-settings", (req, res) => {
    res.json({
      ok: true,
      settings: readTenantDoc<BookingSettings>(dealershipId(req), "bookingSettings", DEFAULT_BOOKING_SETTINGS),
    });
  });

  app.put("/booking-settings", requireStaffRole("manager"), (req, res) => {
    const { openDays, openTime, closeTime, slotMinutes, closedDates } = req.body ?? {};
    if (
      !Array.isArray(openDays) ||
      typeof openTime !== "string" ||
      typeof closeTime !== "string" ||
      typeof slotMinutes !== "number" ||
      slotMinutes < 5 ||
      (closedDates !== undefined &&
        (!Array.isArray(closedDates) || closedDates.some((d: unknown) => typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d))))
    ) {
      return res.status(400).json({ ok: false, error: "openDays, openTime, closeTime, slotMinutes (>=5) and closedDates (yyyy-mm-dd[]) are required" });
    }
    const settings: BookingSettings = { openDays, openTime, closeTime, slotMinutes, closedDates: closedDates ?? [] };
    writeTenantDoc(dealershipId(req), "bookingSettings", settings);
    res.json({ ok: true, settings });
  });
}
