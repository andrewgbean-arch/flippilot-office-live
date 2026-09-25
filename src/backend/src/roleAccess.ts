// Who may see and change what, in one place.
//
// The rules the dealer agreed:
//   - the money (the Bookkeeping ledger, what a car cost, its profit) is for
//     the owner, managers and finance;
//   - staff personal details (NI number, home address, private notes) and
//     sick-leave reasons are for the owner and managers;
//   - removing a car from stock is for the owner and managers;
//   - everyone can see the stock itself: the car, its asking price, its MOT.
//
// Every server check reads these helpers, so a rule is changed here or nowhere.

import type { AuthUser } from "./auth";

type Who = Pick<AuthUser, "role" | "staffRole">;

// The Bookkeeping ledger and every figure built from it.
export function canSeeMoney(user: Who): boolean {
  return user.role === "owner" || user.staffRole === "manager" || user.staffRole === "finance";
}

// Staff records, the rota, leave and clock times: the people who manage people.
export function canManageStaff(user: Who): boolean {
  return user.role === "owner" || user.staffRole === "manager";
}

// What a car cost the dealer, and the figures worked out from it. The asking
// price (priceRetail) and the price it sold for are not here: the sales team
// quotes and agrees those.
export const VEHICLE_MONEY_FIELDS: readonly string[] = [
  "buyPrice",
  "purchasePrice",
  "priceTrade", // the app keeps the buy price here too (InventoryProvider)
  "expectedSale",
  "costs", // links to the car's ledger entries
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// A car as someone who can't see money should receive it.
export function withoutVehicleMoney<T>(car: T): T {
  if (!isRecord(car)) return car;
  const copy: Record<string, unknown> = { ...car };
  for (const field of VEHICLE_MONEY_FIELDS) delete copy[field];
  return copy as T;
}

// A whole car sent by someone who can't see money, about to replace the car
// the server holds. They never saw its money fields, so whatever they sent for
// them (nothing, or a stale value) is replaced by what is stored: their save
// can neither wipe nor change what a car cost.
export function keepStoredVehicleMoney(sent: unknown, stored: unknown): unknown {
  if (!isRecord(sent)) return sent;
  const result: Record<string, unknown> = { ...sent };
  for (const field of VEHICLE_MONEY_FIELDS) {
    if (isRecord(stored) && field in stored) result[field] = stored[field];
    else delete result[field];
  }
  return result;
}

// Staff directory fields only the owner and managers see.
export const STAFF_PRIVATE_FIELDS: readonly string[] = ["nationalInsurance", "address", "notes"];

export function withoutStaffPrivate<T>(record: T): T {
  if (!isRecord(record)) return record;
  const copy: Record<string, unknown> = { ...record };
  for (const field of STAFF_PRIVATE_FIELDS) delete copy[field];
  return copy as T;
}

// Goal kinds measured in money.
export function isMoneyGoalMetric(metric: unknown): boolean {
  return metric === "revenue" || metric === "profit";
}
