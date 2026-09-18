// Pilot Brain used to see only "appointment booked" — never whether the
// customer turned up, or bought. This turns the real outcomes staff
// record (showed / purchased / no_show) into plain-text lines for the
// business snapshot, in the same evidence-only style as the rest of it:
// every number is a count of real stored records, and when nothing has
// been recorded yet it says so rather than implying a rate.

export interface OutcomeAppointment {
  type: string;
  requestedDate: string;
  requestedTime?: string;
  status: string;
  outcome?: string;
}

const DAY_MS = 86400000;
export const OUTCOME_WINDOW_DAYS = 90;
// Below this many recorded outcomes a percentage is more noise than
// signal — the snapshot still gives the counts, but says so.
const SMALL_SAMPLE = 5;

function appointmentTime(a: OutcomeAppointment): number {
  return new Date(`${a.requestedDate}T${a.requestedTime ?? "00:00"}`).getTime();
}

function pct(part: number, whole: number): number {
  return Math.round((part / whole) * 100);
}

export function summariseAppointmentOutcomes(appointments: OutcomeAppointment[], now: number): string[] {
  const cutoff = now - OUTCOME_WINDOW_DAYS * DAY_MS;

  // Only appointments whose time has already passed, inside the window —
  // a future booking hasn't had an outcome yet, and a very old one is
  // history, not the current picture.
  const happened = appointments.filter(a => {
    const t = appointmentTime(a);
    return !Number.isNaN(t) && t >= cutoff && t <= now;
  });

  const recorded = happened.filter(
    a => a.outcome === "showed" || a.outcome === "purchased" || a.outcome === "no_show"
  );
  const awaiting = happened.filter(
    a => (a.status === "confirmed" || a.status === "completed") && !a.outcome
  ).length;

  const lines: string[] = [];

  if (recorded.length === 0) {
    lines.push(
      `Appointment outcomes (last ${OUTCOME_WINDOW_DAYS} days): none recorded yet — staff mark each appointment as showed / bought / no-show once it has happened, and until they do there's no way to tell how many bookings actually turned up or bought.`
    );
  } else {
    const showed = recorded.filter(a => a.outcome === "showed").length;
    const purchased = recorded.filter(a => a.outcome === "purchased").length;
    const noShow = recorded.filter(a => a.outcome === "no_show").length;
    const attended = showed + purchased;

    const caution =
      recorded.length < SMALL_SAMPLE ? ` (only ${recorded.length} recorded — too few to call a trend)` : "";
    lines.push(
      `Appointment outcomes (last ${OUTCOME_WINDOW_DAYS} days, ${recorded.length} recorded): ${attended} attended (${showed} showed, ${purchased} bought), ${noShow} no-show — show rate ${pct(attended, recorded.length)}%${caution}.`
    );

    // An MOT booking is the customer's own car, so it can never end in a
    // purchase — leave those out of the "did they buy" rate, or every MOT
    // that turned up would drag it down.
    const attendedViewings = recorded.filter(
      a => (a.outcome === "showed" || a.outcome === "purchased") && a.type !== "mot"
    );
    if (attendedViewings.length > 0) {
      const bought = attendedViewings.filter(a => a.outcome === "purchased").length;
      lines.push(
        `Of ${attendedViewings.length} viewings/test drives that were attended, ${bought} bought (${pct(bought, attendedViewings.length)}%).`
      );
    }
  }

  if (awaiting > 0) {
    lines.push(
      `${awaiting} past appointment${awaiting === 1 ? "" : "s"} in that window still ${awaiting === 1 ? "has" : "have"} no recorded outcome.`
    );
  }

  return lines;
}
