// What the Delete Vehicle confirmation (EditVehicle.tsx) says about Bookkeeping.
//
// Deleting a car removes it from stock and nothing else: its purchase, sale and
// cost entries stay in Bookkeeping, now pointing at a car that isn't there. The
// sale's invoice is opened by looking the car up (Invoice.tsx), so once the car
// is gone it can no longer be opened, and the ledgers can no longer name the car
// their entries belong to. The delete is still allowed (the owner may want it),
// so the confirmation says plainly what it will leave behind.

export interface BookkeepingRecordCounts {
  sales: number;
  purchases: number;
  costs: number;
}

interface HasVehicleId {
  vehicleId: string;
}

// How many Bookkeeping entries belong to this car.
export function countBookkeepingRecords(
  ledger: {
    sales: readonly HasVehicleId[];
    purchases: readonly HasVehicleId[];
    costs: readonly HasVehicleId[];
  },
  vehicleId: string
): BookkeepingRecordCounts {
  const forThisCar = (entries: readonly HasVehicleId[]) => entries.filter((entry) => entry.vehicleId === vehicleId).length;
  return {
    sales: forThisCar(ledger.sales),
    purchases: forThisCar(ledger.purchases),
    costs: forThisCar(ledger.costs),
  };
}

function countOf(n: number, singular: string, plural: string): string {
  return n === 1 ? `a ${singular}` : `${n} ${plural}`;
}

// The sentence to show, or null when the car has no Bookkeeping records (and
// there is nothing extra to say). Example, for a sale, a purchase and 2 costs:
//   "This car has 4 records in Bookkeeping (a sale, a purchase, 2 costs).
//    Deleting it leaves those records without a car, and an invoice for it can
//    no longer be opened."
// The invoice clause is only there when the car has a sale, because only a sale
// has an invoice.
export function bookkeepingDeleteWarning(records: BookkeepingRecordCounts): string | null {
  const { sales, purchases, costs } = records;
  const total = sales + purchases + costs;
  if (total === 0) return null;

  const parts: string[] = [];
  if (sales > 0) parts.push(countOf(sales, "sale", "sales"));
  if (purchases > 0) parts.push(countOf(purchases, "purchase", "purchases"));
  if (costs > 0) parts.push(countOf(costs, "cost", "costs"));

  const invoice =
    sales === 0 ? "" : sales === 1 ? ", and an invoice for it can no longer be opened" : ", and invoices for it can no longer be opened";

  return (
    `This car has ${total} ${total === 1 ? "record" : "records"} in Bookkeeping (${parts.join(", ")}). ` +
    `Deleting it leaves ${total === 1 ? "that record" : "those records"} without a car${invoice}.`
  );
}
