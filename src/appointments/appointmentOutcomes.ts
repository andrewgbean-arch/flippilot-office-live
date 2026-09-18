import type { AppointmentOutcome, AppointmentType } from "./appointmentTypes";

export const OUTCOME_OPTIONS: { value: AppointmentOutcome; label: string }[] = [
  { value: "showed", label: "Showed up" },
  { value: "purchased", label: "Bought" },
  { value: "no_show", label: "No-show" },
];

// An MOT booking is the customer's own car, so it can never end in a
// purchase — the backend rejects it, and the screen shouldn't offer it.
export function outcomeOptionsFor(type: AppointmentType) {
  return OUTCOME_OPTIONS.filter((o) => !(o.value === "purchased" && type === "mot"));
}
