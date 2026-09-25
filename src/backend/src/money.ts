// How the server writes money in text it sends out (Pilot Brain's facts, AI
// listing prompts, suggestions): "£65,550", "-£300", "£6,940.30".
//
// `£${x.toLocaleString()}` used to do this. It follows the server's own
// language setting and drops trailing pence ("£6,940.3"), or keeps three
// decimal places of a raw average ("£8,123.333").

const whole = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0, minimumFractionDigits: 0 });
const pence = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2, minimumFractionDigits: 2 });

// Whole pounds when the amount has none, pence when it does. An average or a
// forecast should be passed through Math.round first if pence would be noise.
export function formatPounds(amount: number): string {
  if (!Number.isFinite(amount)) return "an unknown amount";
  const hasPence = Math.round(amount * 100) % 100 !== 0;
  const text = (hasPence ? pence : whole).format(amount);
  return text.replace(/^-(£0(?:\.00)?)$/, "$1");
}
