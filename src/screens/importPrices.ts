import { readOptionalMoney } from "@/lib/parseMoney";

// The two price columns of a vehicle CSV, read strictly.
//
// The import used to do `Number(text) || null`, which drops a perfectly ordinary
// "£5,000" (Excel's currency format) without a word, so the car arrived with no
// price and nothing said so. Now a price that reads is kept ("£5,000",
// "5,000", "5000.50"), a blank (or 0) is left unset, and a price that is TYPED
// but cannot be read ("5,00", "abc", "4.500,00") is left unset AND reported, so
// the summary can say how many cars need their price checking. Nothing is
// silently zero.
export interface ImportPrices {
  buyPrice: number | null;
  sellPrice: number | null;
  // The labels of the price columns that had something in them that could not be read.
  unreadable: string[];
}

export const BUY_PRICE_LABEL = "Buy / Trade Price";
export const SELL_PRICE_LABEL = "Sell / Retail Price";

export function readImportPrices(values: { buyPrice?: string; sellPrice?: string }): ImportPrices {
  const unreadable: string[] = [];

  const buy = readOptionalMoney(values.buyPrice);
  if (!buy.ok) unreadable.push(BUY_PRICE_LABEL);

  const sell = readOptionalMoney(values.sellPrice);
  if (!sell.ok) unreadable.push(SELL_PRICE_LABEL);

  return {
    buyPrice: buy.ok ? buy.value : null,
    sellPrice: sell.ok ? sell.value : null,
    unreadable,
  };
}

// "3 rows had a price that could not be read, so it was left blank."
export function unreadablePriceSummary(rows: number): string | null {
  if (rows <= 0) return null;
  return `${rows} row${rows === 1 ? "" : "s"} had a price that could not be read, so ${
    rows === 1 ? "it was" : "those prices were"
  } left blank. Check the buy and sell prices on ${rows === 1 ? "that car" : "those cars"}.`;
}

// The two whole-number columns of a vehicle CSV, read the same careful way.
//
// The import used to do `Number(text) || null` on Year and Mileage too. A mileage
// written the way a spreadsheet shows it ("45,000") is NaN to Number, so it was
// dropped without a word, exactly as "£5,000" once was. Now "45,000" and "45000"
// both read, blank (or 0) is left unset, and a value that is TYPED but cannot be
// read ("45k", "2014.5", "TBC") is left unset AND reported.
export const MILEAGE_LABEL = "Mileage";
export const YEAR_LABEL = "Year";

export interface ImportCounts {
  year: number | null;
  mileage: number | null;
  // The labels of the columns that had something in them that could not be read.
  unreadable: string[];
}

const WHOLE_NUMBER = /^(?:\d+|\d{1,3}(?:,\d{3})+)$/;
const MAX_MILEAGE = 2_000_000;
const EARLIEST_YEAR = 1900;

type WholeRead = { ok: true; value: number | null } | { ok: false };

function readWholeNumber(input: string | undefined, min: number, max: number): WholeRead {
  const text = (input ?? "").trim();
  if (text === "") return { ok: true, value: null };
  if (!WHOLE_NUMBER.test(text)) return { ok: false };
  const value = Number(text.replace(/,/g, ""));
  if (value === 0) return { ok: true, value: null };
  if (!Number.isSafeInteger(value) || value < min || value > max) return { ok: false };
  return { ok: true, value };
}

export function readImportCounts(values: { year?: string; mileage?: string }, now: Date = new Date()): ImportCounts {
  const unreadable: string[] = [];

  const year = readWholeNumber(values.year, EARLIEST_YEAR, now.getFullYear() + 1);
  if (!year.ok) unreadable.push(YEAR_LABEL);

  const mileage = readWholeNumber(values.mileage, 1, MAX_MILEAGE);
  if (!mileage.ok) unreadable.push(MILEAGE_LABEL);

  return {
    year: year.ok ? year.value : null,
    mileage: mileage.ok ? mileage.value : null,
    unreadable,
  };
}

// "2 rows had a mileage or year that could not be read, so those were left blank."
export function unreadableCountSummary(rows: number): string | null {
  if (rows <= 0) return null;
  return `${rows} row${rows === 1 ? "" : "s"} had a year or mileage that could not be read, so ${
    rows === 1 ? "it was" : "those were"
  } left blank. Check the year and mileage on ${rows === 1 ? "that car" : "those cars"}.`;
}

// The Date Bought column, read the same careful way.
//
// Every imported car's purchase used to be dated with the moment of the import
// (as a full UTC timestamp), so a whole stock list looked bought today. Now a
// date in the file is used: 2026-08-14 (with or without a time after it), or the
// UK way round, 14/08/2026, 14-08-2026, 14.08.2026 or 14/8/26. Slashes are always
// read day first, as a UK spreadsheet writes them. A blank takes the import day;
// a date that is typed but can't be read (or is in the future) takes the import
// day too, and is COUNTED so the summary can say so.
export const DATE_BOUGHT_LABEL = "Date Bought";

/** Today as the dealer sees it (YYYY-MM-DD), not UTC's. */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function realDate(y: number, m: number, d: number): string | null {
  if (y < 1990 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null; // 31/02 etc.
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function readImportDate(input: string | undefined, now: Date = new Date()): { date: string; unreadable: boolean } {
  const today = todayLocal(now);
  const text = (input ?? "").trim();
  if (text === "") return { date: today, unreadable: false };

  let found: string | null = null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text);
  const uk = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  if (iso) found = realDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  else if (uk) {
    const year = uk[3]!.length === 2 ? 2000 + Number(uk[3]) : Number(uk[3]);
    found = realDate(year, Number(uk[2]), Number(uk[1]));
  }
  if (found === null || found > today) return { date: today, unreadable: true };
  return { date: found, unreadable: false };
}

// "2 rows had a date bought that could not be read, so the import day was used."
export function unreadableDateSummary(rows: number): string | null {
  if (rows <= 0) return null;
  return `${rows} row${rows === 1 ? "" : "s"} had a date bought that could not be read, so today's date was used for ${
    rows === 1 ? "that car's" : "those cars'"
  } purchase.`;
}

// The preview's warning for a row with values it can't read. Prices, a year and a
// mileage are left blank; a date bought becomes today's date instead.
export function unreadableRowWarning(labels: string[]): string {
  const blanks = labels.filter((l) => l !== DATE_BOUGHT_LABEL);
  const parts: string[] = [];
  if (blanks.length > 0) parts.push(`${blanks.join(" and ")} can't be read and will be left blank`);
  if (labels.includes(DATE_BOUGHT_LABEL)) parts.push(`${DATE_BOUGHT_LABEL} can't be read, so today's date will be used`);
  return `Ready, but ${parts.join("; ")}`;
}
