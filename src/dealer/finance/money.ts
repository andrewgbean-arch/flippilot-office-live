// Small helpers shared by the finance screens: reading what a dealer typed into
// a money box, and printing pounds.

export type AmountInput = number | string | null | undefined;

/**
 * Turns whatever the form holds into a usable amount. Blank, non-numeric,
 * negative and non-finite entries are "missing" (null): a blank field is not
 * the same thing as an entered 0.
 */
export function toAmount(raw: AmountInput): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** "£1,234.50" or "-£1,234.50". */
export function formatMoney(value: number): string {
  const pence = Math.round(value * 100);
  // A value that rounds to nothing must not print as "-£0.00".
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(pence) / 100;
  return `${sign}£${abs.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
