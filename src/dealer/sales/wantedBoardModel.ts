// The Wanted Cars page, apart from how it looks: how each person can be
// reached, what a request says in words, and how the list is grouped.
//
// Nothing here sends anything. A link opens the dealer's own phone or email app
// with the message ready to read and send (or change) themselves.
import { mailtoHref } from "@/lib/mailto";
import type { WantedItem, WantedMatch } from "@/lib/wantedApi";

const DAY_MS = 86_400_000;

// A person's own words, or what they are after, as one line.
export function wantText(item: Pick<WantedItem, "make" | "model" | "note">): string {
  const car = [item.make, item.model].filter(Boolean).join(" ");
  return car || item.note || "A car (no details given)";
}

export function budgetText(maxPrice: number | undefined): string | null {
  return maxPrice === undefined ? null : `Up to £${maxPrice.toLocaleString("en-GB")}`;
}

// "Ford Fiesta (£995 over their budget)" / "2019 Ford Fiesta, £8,495".
export function matchText(m: WantedMatch): string {
  const price = m.price !== null ? `£${m.price.toLocaleString("en-GB")}` : "no price yet";
  return m.overBudgetBy !== undefined
    ? `${m.label}, ${price} (£${m.overBudgetBy.toLocaleString("en-GB")} over their budget)`
    : `${m.label}, ${price}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

// How long ago, in the words a person would use.
export function askedText(askedAt: string, now: number = Date.now()): string {
  const then = Date.parse(askedAt);
  if (!Number.isFinite(then)) return "";
  const days = Math.floor((now - then) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

// The date their details will be forgotten if they don't ask again.
export function keptUntil(askedAt: string, retentionDays: number): string {
  const then = Date.parse(askedAt);
  if (!Number.isFinite(then)) return "";
  return new Date(then + retentionDays * DAY_MS).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// ---- reaching them ----

export interface ContactLinks {
  call?: string;
  text?: string;
  email?: string;
}

// An address that could not add a cc, a subject or anything else to a mailto: link.
const SAFE_EMAIL = /^[^\s@<>()[\]\\,;:"?&=%#/]+@[^\s@<>()[\]\\,;:"?&=%#/]+$/;

const dialable = (phone: string): string => phone.replace(/[^\d+]/g, "");

// The message ready in the dealer's phone or email. It only ever says "we've just
// got one" when there really is a matching car; otherwise it just says hello.
export function messageFor(item: Pick<WantedItem, "name" | "make" | "model">, dealerName: string, matchLabel?: string): string {
  const hello = firstName(item.name) ? `Hi ${firstName(item.name)}, ` : "Hello, ";
  const from = dealerName ? `it's ${dealerName}. ` : "";
  const car = [item.make, item.model].filter(Boolean).join(" ");
  const body = matchLabel
    ? `We've just got a ${matchLabel} in, which is what you asked us to look out for. Would you like to come and see it?`
    : car
      ? `About the ${car} you asked us to look out for.`
      : "About the car you asked us to look out for.";
  return `${hello}${from}${body}`;
}

export function contactLinks(item: Pick<WantedItem, "name" | "phone" | "email" | "make" | "model">, dealerName: string, matchLabel?: string): ContactLinks {
  const message = messageFor(item, dealerName, matchLabel);
  const number = item.phone ? dialable(item.phone) : "";
  const email = item.email && SAFE_EMAIL.test(item.email) ? item.email : "";
  return {
    ...(number ? { call: `tel:${number}`, text: `sms:${number}?&body=${encodeURIComponent(message)}` } : {}),
    ...(email
      ? { email: mailtoHref(email, { subject: dealerName ? `${dealerName}: the car you asked about` : "The car you asked about", body: message }) }
      : {}),
  };
}

// ---- the list ----

export interface WantedGroups {
  waitingWithCar: WantedItem[];
  waiting: WantedItem[];
  contacted: WantedItem[];
  closed: WantedItem[];
}

// The server sends them most useful first; this only splits them up to be shown.
export function groupWanted(items: readonly WantedItem[]): WantedGroups {
  const groups: WantedGroups = { waitingWithCar: [], waiting: [], contacted: [], closed: [] };
  for (const item of items) {
    if (item.status === "closed") groups.closed.push(item);
    else if (item.status === "contacted") groups.contacted.push(item);
    else if (item.matches.length > 0) groups.waitingWithCar.push(item);
    else groups.waiting.push(item);
  }
  return groups;
}

// How many people are waiting for this particular car, for the note on its page.
export function waitingForCar(items: readonly WantedItem[], vehicleId: string): WantedItem[] {
  return items.filter(i => i.status === "waiting" && i.matches.some(m => m.vehicleId === vehicleId));
}

// The note on a car's own page.
export function waitingSentence(count: number): string {
  return `${count} ${count === 1 ? "person is" : "people are"} waiting for a car like this.`;
}
