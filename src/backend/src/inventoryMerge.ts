// The rules for saving a dealer's stock, kept free of Express and the
// database so they can be tested on their own.
//
// Saving stock is an UPSERT, never a replace. The web app sends what it has
// on screen, and that can be out of date in any direction (another
// person added a car, a phone added photos). So a car the server holds that
// is missing from what was sent is KEPT: absence never means "delete".
// A car only goes when its id is listed, deliberately, in `deletedIds`.

type VehicleRecord = Record<string, unknown>;

// The id of a stored or submitted vehicle, or null for anything that can't
// be told apart from another (not an object, or no usable string id).
export function vehicleId(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const id = (item as VehicleRecord).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export type DeletedIds = { ok: true; ids: string[] } | { ok: false; error: string };

// `deletedIds` is optional. When it IS there it has to be an array of
// non-empty strings: a destructive field is checked strictly, and a
// request that fails the check writes nothing at all.
export function parseDeletedIds(raw: unknown): DeletedIds {
  if (raw === undefined) return { ok: true, ids: [] };
  if (!Array.isArray(raw) || !raw.every(id => typeof id === "string" && id.length > 0)) {
    return { ok: false, error: "deletedIds must be a list of vehicle ids" };
  }
  return { ok: true, ids: [...new Set(raw as string[])] };
}

// What the server should hold after a save.
//
//  - A car the server already has keeps its place in the list and is
//    replaced, in place, by the version that was sent (last write wins per
//    car; the sent list's own order is ignored, so a screen that loaded the
//    cars in a different order can't shuffle them).
//  - A car the server has not seen is added at the END, in the order sent.
//  - A car the server has that was not sent is left exactly as it is.
//  - A car listed in `deletedIds` is removed, even if it was also sent:
//    the explicit request wins.
//  - Entries with no usable id (not a vehicle) can't be matched to anything,
//    so those that are SENT are ignored rather than piling up copy after
//    copy; those already STORED are kept, because nothing is ever deleted
//    on the strength of not recognising it.
//  - Sent twice with the same id: the later copy wins, at the earlier slot.
export function mergeVehicleSave(
  existing: readonly unknown[],
  sent: readonly unknown[],
  deletedIds: ReadonlySet<string>
): unknown[] {
  const incoming = new Map<string, unknown>();
  for (const item of sent) {
    const id = vehicleId(item);
    if (id !== null && !deletedIds.has(id)) incoming.set(id, item);
  }

  const merged: unknown[] = [];
  const alreadyStored = new Set<string>();
  for (const item of existing) {
    const id = vehicleId(item);
    if (id === null) {
      merged.push(item);
      continue;
    }
    if (deletedIds.has(id)) continue;
    alreadyStored.add(id);
    merged.push(incoming.has(id) ? incoming.get(id) : item);
  }

  for (const [id, item] of incoming) {
    if (!alreadyStored.has(id)) merged.push(item);
  }
  return merged;
}
