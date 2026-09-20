// The rules for saving a dealer's stock, kept free of Express and the
// database so they can be tested on their own.
//
// Saving stock is an UPSERT, never a replace. The web app sends what it has
// on screen, and that can be out of date in any direction (another
// person added a car, a phone added photos). So a car the server holds that
// is missing from what was sent is KEPT: absence never means "delete".
// A car only goes when its id is listed, deliberately, in `deletedIds`.
//
// Editing a car that already exists is done with FIELD-LEVEL changes (see
// `VehicleChange` below): "set these fields, remove those", applied onto the
// car as the server holds it right now. Sending a whole car to change one
// field is what lets a stale screen wipe out somebody else's edit to the same
// car, so the newer web app doesn't do it.

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

// ---------------------------------------------------------------------------
// Field-level changes
// ---------------------------------------------------------------------------
//
// One entry says "for the car with this id: remove these fields, then set
// those". It carries no whole record, so it can only ever CHANGE a car that
// exists: it can never bring back one that somebody deleted, and it can never
// overwrite fields it doesn't name.
//
// Deliberate limits (not bugs):
//  - Two people changing the SAME field: the save that arrives later wins for
//    that field.
//  - A field's value is replaced as a whole. `costs`, `images` and `mot` are
//    lists/objects, so two people editing different rows of one list is still
//    "the later save wins" for that list.
export interface VehicleChange {
  id: string; // the car this edit is for
  set?: Record<string, unknown>; // top-level fields to set; each value REPLACES that whole field
  unset?: string[]; // top-level fields to remove
}

// Fields a change can never name. `id` is how the car is found, so it never
// changes; the other three are the names that reach into how objects are
// built, which no vehicle field has any business being called.
export const FORBIDDEN_FIELD_NAMES: readonly string[] = ["id", "__proto__", "constructor", "prototype"];

export type ParsedChanges = { ok: true; changes: VehicleChange[] } | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

// Why a field name can't be used in a change, or null when it can.
function fieldNameProblem(name: unknown): string | null {
  if (typeof name !== "string") return "a field name must be text";
  if (name.length === 0) return "a field name can't be empty";
  if (FORBIDDEN_FIELD_NAMES.includes(name)) return `the field "${name}" can't be changed`;
  return null;
}

// `changes` is optional. When it IS there it is checked strictly, the same way
// `deletedIds` is: anything that isn't exactly the documented shape is REFUSED
// (never trimmed down to a safe subset), and a refused request writes nothing.
// Entries come back as fresh copies, so nothing here is shared with the request.
export function parseChanges(raw: unknown): ParsedChanges {
  if (raw === undefined) return { ok: true, changes: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "changes must be a list of edits" };

  const changes: VehicleChange[] = [];
  // An index loop, not forEach/every: those quietly skip the holes of a sparse list.
  for (let index = 0; index < raw.length; index++) {
    const label = `Change ${index + 1}`;
    const entry: unknown = raw[index];
    if (!isPlainObject(entry)) return { ok: false, error: `${label} must be an object` };

    const id = entry.id;
    if (typeof id !== "string" || id.length === 0) {
      return { ok: false, error: `${label} needs the id of the vehicle it is for` };
    }

    let set: Record<string, unknown> | undefined;
    if (entry.set !== undefined) {
      if (!isPlainObject(entry.set)) return { ok: false, error: `${label}: "set" must be an object of vehicle fields` };
      const pairs = Object.entries(entry.set);
      for (const [name] of pairs) {
        const problem = fieldNameProblem(name);
        if (problem !== null) return { ok: false, error: `${label}: ${problem}` };
      }
      set = Object.fromEntries(pairs);
    }

    let unset: string[] | undefined;
    if (entry.unset !== undefined) {
      if (!Array.isArray(entry.unset)) return { ok: false, error: `${label}: "unset" must be a list of field names` };
      unset = [];
      for (let i = 0; i < entry.unset.length; i++) {
        const name: unknown = entry.unset[i];
        const problem = fieldNameProblem(name);
        if (problem !== null) return { ok: false, error: `${label}: ${problem}` };
        if (set !== undefined && hasOwn(set, name as string)) {
          return { ok: false, error: `${label} both sets and removes the same field` };
        }
        unset.push(name as string);
      }
    }

    changes.push({ id, ...(set !== undefined ? { set } : {}), ...(unset !== undefined ? { unset } : {}) });
  }
  return { ok: true, changes };
}

// A field is always DEFINED as an own data property. Assigning with
// `car[name] = value` would, for the name "__proto__", swap the car's
// prototype instead of adding a field.
function defineField(car: VehicleRecord, name: string, value: unknown): void {
  Object.defineProperty(car, name, { value, writable: true, enumerable: true, configurable: true });
}

// A copy of `car` with the change applied: `unset` fields removed first, then
// `set` fields put in. `id` is never touched, whatever the change says.
function applyOne(car: VehicleRecord, change: VehicleChange): VehicleRecord {
  const next: VehicleRecord = { ...car };
  for (const name of change.unset ?? []) {
    if (name !== "id") delete next[name];
  }
  for (const [name, value] of Object.entries(change.set ?? {})) {
    if (name !== "id") defineField(next, name, value);
  }
  return next;
}

function namesImages(change: VehicleChange): boolean {
  return (change.set !== undefined && hasOwn(change.set, "images")) || (change.unset?.includes("images") ?? false);
}

export interface AppliedChanges {
  cars: unknown[]; // the whole list after the changes
  changed: number; // how many entries were applied to a car that exists
  notFound: string[]; // ids (once each) of entries whose car doesn't exist
  imagesEdited: string[]; // ids of cars an applied entry set or removed `images` on
}

// Applies `changes`, in order, onto `cars` (the list as the server holds it
// NOW). Never changes what it is given: a car an entry touches is replaced by
// a changed copy, every other car is passed through as the very same object.
//
//  - Two entries for one car apply in order, so the later one wins per field.
//  - An entry for a car that isn't there is NOT applied and creates nothing:
//    it has no whole record to create one from. Its id is reported in
//    `notFound` so the sender can tell its user the car is gone.
//  - An entry for an id in `deletedIds` is skipped without a word: the same
//    request is deleting that car, so the entry is neither applied nor "lost".
//  - If the stored list somehow holds the same id twice, every copy is changed
//    (as a whole-car save would replace every copy) and the entry counts once.
export function applyVehicleChanges(
  cars: readonly unknown[],
  changes: readonly VehicleChange[],
  deletedIds: ReadonlySet<string>
): AppliedChanges {
  const result = [...cars];
  const places = new Map<string, number[]>();
  result.forEach((car, place) => {
    const id = vehicleId(car);
    if (id === null) return;
    const list = places.get(id);
    if (list) list.push(place);
    else places.set(id, [place]);
  });

  let changed = 0;
  const notFound = new Set<string>();
  const imagesEdited = new Set<string>();
  for (const change of changes) {
    if (deletedIds.has(change.id)) continue;
    const found = places.get(change.id);
    if (!found) {
      notFound.add(change.id);
      continue;
    }
    for (const place of found) result[place] = applyOne(result[place] as VehicleRecord, change);
    changed += 1;
    if (namesImages(change)) imagesEdited.add(change.id);
  }
  return { cars: result, changed, notFound: [...notFound], imagesEdited: [...imagesEdited] };
}
