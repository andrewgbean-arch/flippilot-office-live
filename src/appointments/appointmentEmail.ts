import { mailtoHref } from "@/lib/mailto";
import type { Appointment, AppointmentStatus } from "./appointmentTypes";

// The "Email Customer" link shown after staff confirm, decline or save an
// appointment request: a pre-filled email to the address the customer typed
// into the open booking form. That address came from a stranger, so it goes
// through mailtoHref like every other value here (see lib/mailto.ts) and can
// never add a recipient or change the subject.
export interface AppointmentEmailInput {
  appointment: Appointment;
  // "test drive", "MOT" or "viewing"
  typeLabel: string;
  // What staff just did: confirmed, declined, or only saved a time change
  savedStatus: AppointmentStatus;
  // The date and time as staff left them (they may differ from the request)
  date: string;
  time: string;
  timeChanged: boolean;
}

// null when the customer gave no email address (they may have given a phone number instead).
export function appointmentEmailHref({ appointment, typeLabel, savedStatus, date, time, timeChanged }: AppointmentEmailInput): string | null {
  if (!appointment.customerEmail) return null;
  const outcome =
    savedStatus === "confirmed"
      ? timeChanged
        ? `We'd like to confirm your ${typeLabel} for ${date} at ${time} (your original request was ${appointment.requestedDate} at ${appointment.requestedTime}). Let us know if that works.`
        : `Your ${typeLabel} is confirmed for ${date} at ${time}.`
      : `Unfortunately we're unable to confirm your requested slot — please get in touch and we'll find a time that works.`;
  return mailtoHref(appointment.customerEmail, {
    subject: `Your ${typeLabel} — ${appointment.vehicleLabel}`,
    body: [`Hi ${appointment.customerName},`, ``, outcome, ``, `Thanks,`].join("\n"),
  });
}
