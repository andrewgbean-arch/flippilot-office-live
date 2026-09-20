// The ONE place a typed or imported amount of money is read.
//
// Screens used to do `Number(text) || 0`. That turned a blank into £0, and a
// perfectly ordinary "4,500" or "£4,500" (NaN to Number) into either £0 or an
// empty field, saved without a word. A later £5,000 sale then showed a profit of
// £5,000 (a 100% margin) on a car that really made £500. Nothing here ever turns
// something it cannot read into a number.
//
// What it accepts: "4500", "4,500", "£4,500.50", "  £ 4,500  ", "0.50", and
// (only when the caller says a minus is allowed) "-250" or "-£250".
//
// What it refuses, each with a message a dealer can act on:
//   - blank, letters, "1e3", "Infinity", "0x1F", "NaN", stray dots or spaces
//   - a comma that is not separating groups of three digits ("4,5", "1,23,456",
//     "4500,50"): it could be a decimal comma, so it is not guessed at
//   - the continental "4.500,00" / "1.234.567" (dots for thousands), for the
//     same reason
//   - more than 2 decimal places (money is pounds and pence)
//   - a minus sign, unless the caller allows one
//   - zero, if the caller needs a positive amount
//   - anything above one billion pounds (a slipped key, and beyond where a
//     JavaScript number stays exact)
//
// It reads text, it never rounds, and it never returns 0 for "could not read".

// A sane ceiling for one amount in this app. Also keeps every accepted number
// far inside the range where a double holds pence exactly.
export const MAX_MONEY = 1_000_000_000;

export interface MoneyOptions {
  // A leading minus is a valid amount (e.g. a refund). Default: refused.
  allowNegative?: boolean;
  // The amount must be greater than zero (a price, a cost). Default: 0 is fine.
  positive?: boolean;
  // What to say for a blank field, so a form can say "Enter the sale price."
  blankMessage?: string;
}

export type MoneyProblem =
  | "blank"
  | "unreadable"
  | "commas"
  | "european"
  | "pence"
  | "negative"
  | "not-positive"
  | "too-large";

export type MoneyRead =
  | { ok: true; value: number }
  | { ok: false; reason: MoneyProblem; message: string };

const MESSAGES: Record<Exclude<MoneyProblem, "blank">, string> = {
  unreadable: "Enter an amount in pounds, like 4500 or £4,500.50.",
  commas:
    "Commas can only separate thousands, like 4,500 or 12,500.50. For pence use a dot, like 4500.50.",
  european:
    "That looks like a European-style number. Type it with a dot for pence and commas for thousands, like 4,500.00 or 4500.",
  pence: "Pounds and pence only: no more than 2 decimal places, like 4500.50.",
  negative: "Enter an amount with no minus sign.",
  "not-positive": "Enter an amount greater than £0.",
  "too-large": "That amount is too large. Check for an extra digit.",
};

const fail = (reason: Exclude<MoneyProblem, "blank">): MoneyRead => ({ ok: false, reason, message: MESSAGES[reason] });

// 0, or 1-9 then digits, or 1-9 then up to two digits then ,ddd groups.
const AMOUNT = /^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.(\d+))?$/;
// Dots as thousands separators, with or without a decimal comma.
const CONTINENTAL = /^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d+)?$/;

export function readMoney(input: unknown, options: MoneyOptions = {}): MoneyRead {
  const blank: MoneyRead = { ok: false, reason: "blank", message: options.blankMessage ?? "Enter an amount." };

  let text: string;
  if (input === null || input === undefined) return blank;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return fail("unreadable");
    text = String(input);
  } else if (typeof input === "string") {
    text = input;
  } else {
    return fail("unreadable");
  }

  // Word and Excel paste a real minus sign (U+2212); trim() also drops the
  // non-breaking spaces a copied cell carries.
  text = text.replace(/\u2212/g, "-").trim();
  if (text === "") return blank;

  let negative = false;
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1).trimStart();
  }
  if (text.startsWith("£")) text = text.slice(1).trimStart();
  if (!negative && text.startsWith("-")) {
    negative = true;
    text = text.slice(1).trimStart();
  }

  // Say WHY when it is a comma or continental problem, rather than a bare "not a number".
  if (CONTINENTAL.test(text)) return fail("european");
  const match = AMOUNT.exec(text);
  if (!match) return fail(/^[\d,.]+$/.test(text) && text.includes(",") ? "commas" : "unreadable");

  const decimals = match[1];
  if (decimals !== undefined && decimals.length > 2) return fail("pence");

  const magnitude = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(magnitude) || magnitude > MAX_MONEY) return fail("too-large");

  if (negative && !options.allowNegative) return fail("negative");

  // "-0" is just 0, never a negative zero.
  const value = negative && magnitude !== 0 ? -magnitude : magnitude;
  if (options.positive && !(value > 0)) return fail("not-positive");
  return { ok: true, value };
}

// The number, or null when the text is blank or cannot be read. Never 0 for
// "could not read": 0 is only ever returned for text that really says zero.
export function parseMoney(input: unknown, options: MoneyOptions = {}): number | null {
  const read = readMoney(input, options);
  return read.ok ? read.value : null;
}

// The message to show under a field, or null when the text is fine.
export function moneyProblem(input: unknown, options: MoneyOptions = {}): string | null {
  const read = readMoney(input, options);
  return read.ok ? null : read.message;
}

// A stored amount that can be trusted as a real price: a finite number above
// zero. A blank that was once saved as 0, or a NaN that JSON turned into null,
// is NOT a price and must never be treated as one.
export function isPositiveAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
