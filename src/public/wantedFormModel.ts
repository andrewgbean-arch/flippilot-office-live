// The "tell me when you get one" form, apart from how it looks: what a
// person has typed, whether it is enough to send, and what is sent. The server
// checks all of this again; these checks are so a person hears what is missing
// before sending, in plain words.
import type { WantedPayload } from "./publicWantedApi";

export interface WantedDraft {
  name: string;
  phone: string;
  email: string;
  make: string;
  model: string;
  // As typed: "8000", "£8,000".
  budget: string;
  note: string;
  consent: boolean;
  // The hidden box.
  website: string;
}

export const emptyDraft: WantedDraft = { name: "", phone: "", email: "", make: "", model: "", budget: "", note: "", consent: false, website: "" };

// The same limits the server holds to.
export const MIN_BUDGET = 500;
export const MAX_BUDGET = 500_000;

// A whole number of pounds, nothing at all, or null when it isn't a sensible budget.
export function readBudget(text: string): number | undefined | null {
  const digits = text.replace(/[£,\s]/g, "");
  if (digits === "") return undefined;
  if (!/^\d+(\.\d+)?$/.test(digits)) return null;
  const n = Math.round(Number(digits));
  return n >= MIN_BUDGET && n <= MAX_BUDGET ? n : null;
}

// What is stopping this being sent, said to the person, or null when nothing is.
export function problemWith(d: WantedDraft): string | null {
  if (d.model.trim() && !d.make.trim()) return "Please add the make as well as the model.";
  if (!d.make.trim() && !d.note.trim()) return "Tell us what you're looking for: a make, or a few words about it.";
  if (readBudget(d.budget) === null) {
    return `Please give a budget between £${MIN_BUDGET.toLocaleString("en-GB")} and £${MAX_BUDGET.toLocaleString("en-GB")}, or leave it blank.`;
  }
  if (!d.name.trim()) return "Please tell us your name.";
  if (!d.phone.trim() && !d.email.trim()) return "Please give a phone number or email so the dealer can reach you.";
  if (!d.consent) return "Please tick the box to say the dealer may contact you about this.";
  return null;
}

// Only what was filled in is sent.
export function toPayload(d: WantedDraft): WantedPayload {
  const budget = readBudget(d.budget);
  const put = (text: string) => text.trim();
  return {
    consent: true,
    name: put(d.name),
    ...(put(d.phone) ? { phone: put(d.phone) } : {}),
    ...(put(d.email) ? { email: put(d.email) } : {}),
    ...(put(d.make) ? { make: put(d.make) } : {}),
    ...(put(d.model) ? { model: put(d.model) } : {}),
    ...(typeof budget === "number" ? { maxPrice: budget } : {}),
    ...(put(d.note) ? { note: put(d.note) } : {}),
    website: d.website,
  };
}

// "Priya Shah" -> "Priya", for "Thanks, Priya".
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
