import type { Vehicle } from "@/types/Vehicle";
import type { SaleEntry } from "@/bookkeeping/types";
import type { Appointment } from "@/appointments/appointmentTypes";
import { motCounts, unsold, withoutPhotos } from "@/dealer/inventory/stockFacts";
import { toDateKey } from "@/planner/dateUtils";

// The four things a new dealership does that turn Pilot Brain from "watching
// an empty board" into something useful. Each ticks itself off from the real
// records, so the card never asks for something that has already been done,
// and it disappears once everything is in place. Pure: the card renders what
// this returns, and Pilot Brain's own snapshot is counted the same way on the
// server (see buildBusinessSummary), so what Boss reads here matches what she
// says.

export type GettingStartedKey = "sale" | "outcomes" | "cars" | "decision";

export interface GettingStartedItem {
  key: GettingStartedKey;
  title: string;
  done: boolean;
  detail: string;
  to: string;
}

export interface GettingStartedInput {
  vehicles: readonly Vehicle[];
  sales: readonly SaleEntry[];
  appointments: readonly Appointment[];
  // null while the count hasn't loaded; the item then reads as not done.
  decisionsTotal: number | null;
  // Owners and managers only: the Decision Journal answers 403 to everyone else.
  canUseDecisions: boolean;
  // The owner, managers and finance: sales live in the Bookkeeping ledger,
  // which nobody else is sent, so for them there is nothing to count.
  canSeeMoney: boolean;
  now: Date;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// A booking that has happened and nobody has said how it went.
export function pastBookingsToMark(appointments: readonly Appointment[], now: Date): Appointment[] {
  const today = toDateKey(now);
  return appointments.filter(
    a => !a.outcome && (a.status === "confirmed" || a.status === "completed") && typeof a.requestedDate === "string" && a.requestedDate < today
  );
}

export function gettingStartedItems(input: GettingStartedInput): GettingStartedItem[] {
  const { vehicles, sales, appointments, decisionsTotal, canUseDecisions, canSeeMoney, now } = input;

  const saleCount = sales.length;
  const sale: GettingStartedItem = {
    key: "sale",
    title: "Record a sale",
    done: saleCount > 0,
    detail: saleCount > 0 ? `${plural(saleCount, "sale")} recorded.` : "Even one shows what moves and what it really made.",
    to: "/bookkeeping/add-sale",
  };

  const marked = appointments.filter(a => a.outcome).length;
  const toMark = pastBookingsToMark(appointments, now).length;
  const outcomes: GettingStartedItem = {
    key: "outcomes",
    title: "Mark how bookings went",
    done: marked > 0,
    detail:
      marked > 0
        ? `${plural(marked, "outcome")} marked${toMark > 0 ? `, ${toMark} still to mark` : ""}.`
        : appointments.length === 0
          ? "Bookings arrive from your public booking page. Mark each one showed, bought or no-show."
          : toMark > 0
            ? `${plural(toMark, "past booking")} to mark showed, bought or no-show.`
            : "Mark each booking showed, bought or no-show once it has happened.",
    to: "/appointments",
  };

  const forSale = unsold(vehicles);
  const noPhotos = withoutPhotos(vehicles).length;
  const noMot = motCounts(vehicles, now).noDate;
  const cars: GettingStartedItem = {
    key: "cars",
    title: "A photo and an MOT date on every car",
    done: forSale.length > 0 && noPhotos === 0 && noMot === 0,
    detail:
      forSale.length === 0
        ? "No cars in stock yet. Add one, or import your stock from a CSV."
        : noPhotos === 0 && noMot === 0
          ? `All ${plural(forSale.length, "car")} have a photo and an MOT date.`
          : [noPhotos > 0 ? `${noPhotos} without a photo` : null, noMot > 0 ? `${noMot} without an MOT date` : null].filter(Boolean).join(", ") + ".",
    to: forSale.length === 0 ? "/new-flip" : "/dealer/inventory/list",
  };

  const items = canSeeMoney ? [sale, outcomes, cars] : [outcomes, cars];
  if (canUseDecisions) {
    items.push({
      key: "decision",
      title: "Write one decision down",
      done: (decisionsTotal ?? 0) > 0,
      detail: (decisionsTotal ?? 0) > 0 ? `${plural(decisionsTotal ?? 0, "decision")} in the journal.` : "A big call with a review date, so there is something to learn from later.",
      to: "/pilot-brain/decisions",
    });
  }
  return items;
}

export function gettingStartedComplete(items: readonly GettingStartedItem[]): boolean {
  return items.length > 0 && items.every(i => i.done);
}

// Hidden by hand, per person, per browser: a convenience like a remembered
// tab, never app state. Browsers can refuse localStorage outright, so every
// touch is guarded.
export const GETTING_STARTED_DISMISSED_KEY = "flippilot.gettingStarted.dismissed";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isGettingStartedDismissed(userId: string | undefined): boolean {
  if (!userId) return false;
  try {
    return storage()?.getItem(`${GETTING_STARTED_DISMISSED_KEY}.${userId}`) === "1";
  } catch {
    return false;
  }
}

export function dismissGettingStarted(userId: string | undefined): void {
  if (!userId) return;
  try {
    storage()?.setItem(`${GETTING_STARTED_DISMISSED_KEY}.${userId}`, "1");
  } catch {
    // nothing to do: the card just shows again next time
  }
}
