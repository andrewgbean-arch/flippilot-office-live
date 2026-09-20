// How a stranger's name, phone number and email are cleaned before they are kept.
// Shared by every public form that takes contact details (the booking form and
// the "tell me when you get one" form), so that the rules cannot drift apart.

import { toSingleLine } from "./untrustedText";

// What a stranger may type into the booking form is stored, shown to staff and
// (the name) read by Pilot Brain, so every free-text field has a limit and is
// cleaned before it is kept — see untrustedText.ts.
export const MAX_NAME_CHARS = 80;
export const MAX_NOTES_CHARS = 500;
export const MAX_EMAIL_CHARS = 254; // the longest an email address can legitimately be
export const MAX_PHONE_CHARS = 40; // room for a mobile and a landline, or a number with an extension

// One address: something, one "@", something. Neither side may hold a space or
// a character that means something in a mailto: link or a web address (? & = %
// # /), so a stored address can never add a cc, a bcc or a subject to the email
// staff send from the "Email Customer" button, or carry a %-escape. Apostrophes
// (O'Brien@example.co.uk is a real address), plus-addressing, dots, hyphens and
// letters of any alphabet are all fine.
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"?&=%#\/]+@[^\s@<>()[\]\\,;:"?&=%#\/]+$/;

// What people type into a contact box they would rather leave empty. It counts
// as nothing at all, so one placeholder cannot lose a booking that has a good
// phone number or email (a booking still needs at least one of the two).
const PLACEHOLDER_CONTACT = /^(?:(?:n\/?a|n\.a|not applicable|none|nil|no|no e-?mail|no phone|x+)\.?|[-?.]+)$/i;

// What the customer is told, on the booking page, when a contact detail is refused.
const PHONE_ADVICE = `Please give one phone number (at least 5 digits, up to ${MAX_PHONE_CHARS} characters), or leave it blank and give an email instead.`;
const EMAIL_ADVICE = "Please give one email address in the form name@example.com, or leave it blank and give a phone number instead.";

// What a contact box came to: a cleaned value, nothing at all (not given, or
// only a placeholder), or something refused, with the advice to show the customer.
export type Contact = { value: string | undefined } | { refused: string };

// undefined: nothing usable given. null: not text, or too long. Otherwise the tidied text.
function readContact(raw: unknown, max: number): string | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return null;
  // Tidied with a limit far above `max`, so that nothing is cut off here: the
  // length is judged on all of what was typed. (Cutting first and measuring
  // after let a value slip through, or lose its second half, depending on
  // where a space fell.)
  const value = toSingleLine(raw, max * 4);
  if (!value || PLACEHOLDER_CONTACT.test(value)) return undefined;
  return Array.from(value).length > max ? null : value;
}

export function cleanEmail(raw: unknown): Contact {
  const value = readContact(raw, MAX_EMAIL_CHARS);
  if (value === undefined) return { value: undefined };
  return value !== null && EMAIL_PATTERN.test(value) ? { value } : { refused: EMAIL_ADVICE };
}

export function cleanPhone(raw: unknown): Contact {
  const value = readContact(raw, MAX_PHONE_CHARS);
  if (value === undefined) return { value: undefined };
  return value !== null && (value.match(/\d/g) ?? []).length >= 5 ? { value } : { refused: PHONE_ADVICE };
}
