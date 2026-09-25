import { Express, Request } from "express";
import { deleteVehiclePhotosFor, readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";
import { applyVehicleChanges, mergeVehicleSave, parseChanges, parseDeletedIds, vehicleId, type VehicleChange } from "../inventoryMerge";
import { keepHostedPhotos, publicOrigin } from "./photos";
import { announceWantedArrivals } from "./wanted";
import { canManageStaff, canSeeMoney, keepStoredVehicleMoney, VEHICLE_MONEY_FIELDS, withoutVehicleMoney } from "../roleAccess";

function dealershipId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.dealershipId;
}

function userOf(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// The stock as this person may see it: without what each car cost, unless
// they can see the money (roleAccess.ts).
function stockFor(user: AuthUser, cars: unknown[]): unknown[] {
  return canSeeMoney(user) ? cars : cars.map(withoutVehicleMoney);
}

// Was hardcoded mock data (Ford Fiesta / BMW 1 Series), then a single
// shared file for every dealer — now scoped per-dealership so one
// dealer's inventory is never visible to another (requireAuth runs
// before this in server.ts, so req.user is always populated here).
export default function registerInventoryRoute(app: Express) {
  app.get("/inventory", (req, res) => {
    res.json({ ok: true, items: stockFor(userOf(req), readTenantCollection(dealershipId(req), "vehicles")) });
  });

  // Saving is an UPSERT plus field-level edits (see inventoryMerge.ts), never
  // a replace of the whole list:
  //   { items: [...], deletedIds?: [...], changes?: [{ id, set?, unset? }] }
  //
  //  - `items` are WHOLE cars: added, or (older clients, unchanged) replacing
  //    the car with the same id. Cars the server has that aren't in `items`
  //    are left alone (the sender's list may simply predate them). The newer
  //    web app sends only cars it has just created here.
  //  - `changes` are field-level edits of cars that already exist: for the
  //    car with that id, remove the `unset` fields, then set the `set`
  //    fields, on the car as the server holds it RIGHT NOW. Fields a change
  //    doesn't name are never touched, so two people editing different
  //    fields of one car both keep their edit; and a change carries no whole
  //    record, so it can never bring back a car someone deleted (its id comes
  //    back in `notFound` instead).
  //  - `deletedIds` are the only way a car goes, together with its hosted
  //    pictures. A change for an id deleted by the same request is skipped.
  //
  // Answers { ok, items, changed, notFound }: the full list as it now stands
  // (so the sender can catch up on anything it hadn't seen), how many changes
  // were applied to an existing car, and the ids (once each) of changes whose
  // car doesn't exist. `changed` is on EVERY 200 reply, 0 when there were no
  // changes, so a client that sends changes can tell an old server (which
  // would ignore them without a word) from a real "0 applied".
  //
  // Anything malformed is refused with a 400 BEFORE anything is written.
  // Everything from reading the stock to writing it happens in one
  // synchronous run (no await), so no other request can slip between the two.
  // Older clients that send a whole list keep working, exactly as before.
  app.put("/inventory", (req, res) => {
    const id = dealershipId(req);
    const body: unknown = req.body;
    const fields: { items?: unknown; deletedIds?: unknown; changes?: unknown } = body && typeof body === "object" ? body : {};
    const items = fields.items;

    // A missing or malformed list must be refused, not read as "no cars":
    // a wrong content-type or a client bug would otherwise wipe the stock.
    if (!Array.isArray(items)) {
      return res.status(400).json({ ok: false, error: "Send your stock as { items: [...] }" });
    }
    const deleted = parseDeletedIds(fields.deletedIds);
    if (!deleted.ok) {
      return res.status(400).json({ ok: false, error: deleted.error });
    }
    const parsed = parseChanges(fields.changes);
    if (!parsed.ok) {
      return res.status(400).json({ ok: false, error: parsed.error });
    }
    const user = userOf(req);
    // Taking a car out of stock, with its pictures, is for the owner and
    // managers. Refused before anything is written, so nothing half-happens.
    if (deleted.ids.length > 0 && !canManageStaff(user)) {
      return res.status(403).json({ ok: false, error: "Only a manager or the owner can remove a car from stock." });
    }
    const money = canSeeMoney(user);

    // ---- read, merge, apply, protect, write: no await from here to the write ----
    const origin = publicOrigin(req);
    const deletedSet = new Set(deleted.ids);

    // Photos added from a phone survive a save from a screen that hadn't
    // seen them yet (see keepHostedPhotos).
    const stored = readTenantCollection<unknown>(id, "vehicles");
    // Someone who can't see what a car cost can't change it either: a whole
    // car they send keeps the stored money fields (they never saw them, so
    // whatever they sent is blank or stale), and their field edits to those
    // fields are dropped. A car they add is new, so what they typed for it
    // stands.
    const storedById = new Map(stored.map(car => [vehicleId(car), car] as const));
    const itemsAllowed = money
      ? items
      : items.map(car => {
          const carId = vehicleId(car);
          return carId !== null && storedById.has(carId) ? keepStoredVehicleMoney(car, storedById.get(carId)) : car;
        });
    const changesAllowed = money ? parsed.changes : parsed.changes.map(withoutMoneyEdits);
    const sent = keepHostedPhotos(id, itemsAllowed, origin);
    const merged = mergeVehicleSave(stored, sent, deletedSet);

    // The field-level edits go onto the merged list, which is the car as it
    // stands now, including anything the whole-car part of this request did.
    const applied = applyVehicleChanges(merged, changesAllowed, deletedSet);

    // A change that set or removed `images` came from a screen that may not
    // have seen a photo a phone added (or one deleted since), just like a
    // whole car would: give those cars the same protection.
    const cars = protectEditedImages(id, applied.cars, applied.imagesEdited, origin);

    // The list first, then the pictures: if this stops in between, the
    // client never got its OK and sends the same deletedIds again, which
    // finishes the job.
    writeTenantCollection(id, "vehicles", cars);
    deleteVehiclePhotosFor(id, deleted.ids);
    // Tell the team if a car has just arrived that people are waiting for. The
    // stock is already saved, and this can never make the save fail.
    announceWantedArrivals(id);
    res.json({ ok: true, items: stockFor(user, cars), changed: applied.changed, notFound: applied.notFound });
  });
}

// A field-level edit with the money fields taken out (see PUT /inventory).
function withoutMoneyEdits(change: VehicleChange): VehicleChange {
  const set = change.set ? Object.fromEntries(Object.entries(change.set).filter(([field]) => !VEHICLE_MONEY_FIELDS.includes(field))) : undefined;
  const unset = change.unset ? change.unset.filter(field => !VEHICLE_MONEY_FIELDS.includes(field)) : undefined;
  return { id: change.id, ...(set ? { set } : {}), ...(unset ? { unset } : {}) };
}

// keepHostedPhotos, for just the cars whose ids are listed. Everything else
// in the list is returned as the very same object, in the same place.
function protectEditedImages(dealership: string, cars: unknown[], editedIds: readonly string[], origin: string): unknown[] {
  if (editedIds.length === 0) return cars;
  const edited = new Set(editedIds);
  const places: number[] = [];
  cars.forEach((car, place) => {
    const carId = vehicleId(car);
    if (carId !== null && edited.has(carId)) places.push(place);
  });

  const protectedCars = keepHostedPhotos(dealership, places.map(place => cars[place]), origin);
  const result = [...cars];
  places.forEach((place, i) => {
    result[place] = protectedCars[i];
  });
  return result;
}
