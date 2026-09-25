// How money is written on screen: "£65,550", "-£14,950", "£1,234.50".
//
// Screens used to build this by hand (`£${x.toFixed(2)}`, `£{x.toLocaleString()}`),
// which gave "£65550.00" with no thousands separator and, for a loss, "£-14950.00"
// with the minus sign in the wrong place. This is the one place that decides.

const whole = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const pence = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export interface MoneyOptions {
  // Show pence ("£1,234.50"). Default is whole pounds, which is what a summary
  // wants; invoices and anything a customer signs want pence. "auto" shows pence
  // only when there are some: "£6,940.30" but "£7,000".
  pence?: boolean | "auto";
}

// "—" for anything that isn't a real number (missing, NaN, infinity) so a screen
// never prints "£NaN" or "£undefined".
export function formatMoney(amount: number | null | undefined, options: MoneyOptions = {}): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  const showPence =
    options.pence === "auto" ? Math.round(amount * 100) % 100 !== 0 : options.pence === true;
  const text = (showPence ? pence : whole).format(amount);
  // A small loss that rounds to nothing must not read "-£0".
  return text.replace(/^-(£0(?:\.00)?)$/, "$1");
}
