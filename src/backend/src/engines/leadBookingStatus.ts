// What a public website booking does to a lead that already exists (matched
// by the customer's phone or email).
//
// It used to overwrite the status unconditionally, so a customer who had
// already bought a car ("won") and later booked anything online was quietly
// reset, the win vanished from every conversion figure, and someone deep in
// negotiation was pushed back to "viewing booked". This is the one place the
// rule lives:
//   - A booking can move a lead FORWARD through the sales stages, never back.
//   - A "won" lead is left alone: they have already bought.
//   - An MOT booking is servicing the customer's own car, not a sales step,
//     so it changes nothing on an existing lead (and never their interest).
//   - A "lost" lead that books a viewing is a genuine re-engagement, so they
//     are reopened at the stage they just booked.

export type BookingType = "viewing" | "test_drive" | "mot";

// Open sales stages, earliest to latest.
const STAGE_ORDER = ["new", "contacted", "viewing_booked", "test_drive", "negotiating"];

export interface LeadBookingUpdate {
  status: string;
  // Whether the lead's "interested vehicle" should become the booked one.
  updateInterest: boolean;
}

// The status a NEW lead gets from a booking (also the stage an existing lead
// is moved up to, if it is behind).
export function bookedStatus(type: BookingType): string {
  return type === "test_drive" ? "test_drive" : type === "mot" ? "mot_booked" : "viewing_booked";
}

export function leadUpdateForBooking(currentStatus: unknown, type: BookingType): LeadBookingUpdate {
  const current = typeof currentStatus === "string" ? currentStatus.trim().toLowerCase() : "";
  const keep = typeof currentStatus === "string" ? currentStatus : "";

  if (type === "mot" || current === "won") return { status: keep, updateInterest: false };

  const target = bookedStatus(type);
  const currentRank = STAGE_ORDER.indexOf(current);
  const targetRank = STAGE_ORDER.indexOf(target);
  // Already at or past the booked stage: stay put. Anything else (behind it,
  // lost, blank, or a status this doesn't know — indexOf gives -1) moves to
  // the booked stage.
  const status = currentRank >= targetRank ? keep : target;
  return { status, updateInterest: true };
}
