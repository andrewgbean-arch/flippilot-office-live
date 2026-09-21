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

export type OptionalMoneyRead =
  | { ok: true; value: number | null }
  | { ok: false; reason: MoneyProblem; message: string };

// For an OPTIONAL stock price (an asking price, a trade price): blank means "not
// priced yet" and comes back as null, never 0. A typed 0 means the same thing (a
// stock car is never really priced at nothing), so it is unset too. Anything
// that is typed but cannot be read is still refused: it is never dropped quietly.
export function readOptionalMoney(input: unknown): OptionalMoneyRead {
  const read = readMoney(input);
  if (read.ok) return { ok: true, value: read.value > 0 ? read.value : null };
  if (read.reason === "blank") return { ok: true, value: null };
  return read;
}

// A stored amount that can be trusted as a real price: a finite number above
// zero. A blank that was once saved as 0, or a NaN that JSON turned into null,
// is NOT a price and must never be treated as one.
export function isPositiveAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/* ------------------------------------------------------------------ *
 * VAT rates (a percentage a dealer types, like 20)
 * ------------------------------------------------------------------ */

// A VAT rate box used to be read with `(Number(text) || 0) / 100`. That turned a
// blank or unreadable rate into 0% (an unknown treated as zero: a sale saved with a
// blank rate printed "VAT (0%) £0.00" and a Total Due equal to the price), kept a
// negative or absurd rate (-20, 200), and read "0.2" (a dealer thinking in
// fractions) as 0.2%. This reads the box strictly instead.
//
// A rate is a percentage from 0 to 100 with at most 2 decimal places ("20", "5",
// "17.5", "20%"). 0 is a real rate but must be TYPED: a blank is never 0. A value
// above 0 and below 1 is refused: no UK VAT rate is under 1%, so "0.2" is a fraction
// typed by someone meaning 20%, and saving it would charge 0.2%.
export type PercentProblem = "blank" | "unreadable" | "negative" | "too-large" | "pence" | "fraction";

export type PercentRead =
  | { ok: true; value: number }
  | { ok: false; reason: PercentProblem; message: string };

const PERCENT_MESSAGES: Record<Exclude<PercentProblem, "blank">, string> = {
  unreadable: "Enter the VAT rate as a percentage, like 20 for 20% or 5 for 5%.",
  negative: "The VAT rate can't be negative.",
  "too-large": "The VAT rate can't be more than 100%.",
  pence: "Use at most 2 decimal places for the VAT rate, like 17.5.",
  fraction: "That reads as under 1%. Type the VAT rate as a percentage, like 20 for 20%, not as a fraction like 0.2.",
};

const PERCENT = /^(\d+)(?:\.(\d+))?$/;

export function readPercent(input: unknown, options: { blankMessage?: string } = {}): PercentRead {
  const fail = (reason: Exclude<PercentProblem, "blank">): PercentRead => ({ ok: false, reason, message: PERCENT_MESSAGES[reason] });
  const blank: PercentRead = {
    ok: false,
    reason: "blank",
    message: options.blankMessage ?? "Enter the VAT rate as a percentage, like 20.",
  };

  if (input === null || input === undefined) return blank;
  let text: string;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return fail("unreadable");
    text = String(input);
  } else if (typeof input === "string") {
    text = input;
  } else {
    return fail("unreadable");
  }

  text = text.replace(/\u2212/g, "-").trim();
  if (text.endsWith("%")) text = text.slice(0, -1).trimEnd();
  if (text === "") return blank;
  if (text.startsWith("-")) return fail("negative");

  const match = PERCENT.exec(text);
  if (!match) return fail("unreadable");
  if ((match[2] ?? "").length > 2) return fail("pence");

  const value = Number(text);
  if (!Number.isFinite(value)) return fail("unreadable");
  if (value > 100) return fail("too-large");
  if (value > 0 && value < 1) return fail("fraction");
  return { ok: true, value };
}

// The message to show under a VAT rate box, or null when the text is fine.
export function percentProblem(input: unknown, options: { blankMessage?: string } = {}): string | null {
  const read = readPercent(input, options);
  return read.ok ? null : read.message;
}

// 20 (a typed percentage) -> 0.2 (the fraction every calculation in the books uses),
// worked in whole hundredths of a percent so 17.5 is exactly 0.175.
export function percentToRate(percent: number): number {
  return Math.round(percent * 100) / 10000;
}

// 0.2 (a stored rate) -> "20" (what goes in the box). A stored rate that is not a
// number gives an empty box, so the reader says "enter the rate" and the dealer
// fixes it, rather than the box showing "NaN" or a made-up 0.
export function rateToPercentText(rate: unknown): string {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return "";
  return String(Math.round(rate * 10000) / 100);
}

// A stored VAT rate that can be worked with: a fraction from 0 to 1 (0.2 is 20%).
// Anything else (NaN or null saved as nothing, a rate of 2 that is really 200%, a
// negative) is not a rate, and no figure may be worked out from it.
export function isValidVatRate(rate: unknown): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate >= 0 && rate <= 1;
}
