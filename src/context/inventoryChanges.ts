import type { Vehicle } from "../types/Vehicle";

// Field-level stock edits: the pure rules behind "send only what the user
// changed". No React, no fetch, so every rule can be tested on its own.
//
// Why this exists. The web app used to send its WHOLE stock list on every save,
// and the server replaced each car wholesale. A screen left open all day holds
// stale copies, so saving ONE car quietly put every other car back to how this
// screen last saw it, and an edit to a car someone else had also changed
// overwrote their change. Now the client sends, for a car that already exists,
// only the fields the user changed (a VehicleChange), and the server applies
// them onto the CURRENT stored car. Two people changing different fields of one
// car both survive.
//
// Deliberate limits (not solved here, on purpose):
//  - The same FIELD changed by two people: the later save wins for that field.
//  - Fields are replaced as a whole. `costs`, `images` and `mot` are arrays or
//    objects, and an edit to one of them sends the whole new value.

// One car's edit as it travels to the server. `set` values REPLACE the whole
// field; `unset` names fields to remove. `id` says which car; it never changes.
export interface VehicleChange {
  id: string;
  set?: Record<string, unknown>;
  unset?: string[];
}

// A whole save request. `items` are cars created here that the server hasn't
// confirmed (sent as complete records); `changes` are edits of cars that already
// exist; `deletedIds` are the cars the user deliberately deleted.
export interface SavePayload {
  items: Vehicle[];
  changes: VehicleChange[];
  deletedIds: string[];
}

// The client's own record of one car's unsent edit. `set` and `unset` never
// name the same field. Treated as immutable: every function here returns a new
// one instead of changing the one it was given, so a copy taken when a save is
// sent stays exactly what was sent.
export interface FieldEdit {
  readonly set: Readonly<Record<string, unknown>>;
  readonly unset: ReadonlySet<string>;
}

// Names that are never part of an edit: `id` (a car keeps its identity) and the
// three the server refuses outright because they can reach an object's
// prototype. Leaving them out of a diff means one odd field on a stored record
// can never make the server refuse every save from this screen from then on.
const NEVER_EDITED: ReadonlySet<string> = new Set(["id", "__proto__", "constructor", "prototype"]);

export function isEditableField(key: string): boolean {
  return !NEVER_EDITED.has(key);
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

// The car's own value for a field. An inherited property (a car with no field
// called "toString" still inherits one) is not a field of the car.
function field(record: object, key: string): unknown {
  return hasOwn(record, key) ? (record as Record<string, unknown>)[key] : undefined;
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Deep structural equality for JSON-shaped data (what a car is once it has been
// through the server):
//  - the same object is trivially the same (also keeps a self-referencing value
//    from looping);
//  - objects are equal when they hold the same values under the same keys, in
//    any key order, ignoring keys whose value is `undefined` (JSON drops those,
//    so "absent" and "undefined" are the same thing);
//  - arrays are equal element by element, in order;
//  - NaN equals NaN; everything else primitive is compared with ===.
// Anything that isn't plain JSON data (a Date, a Map...) is only equal to
// itself: better to call it different, and send it, than to call two different
// dates the same and lose an edit.
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return Number.isNaN(a) && Number.isNaN(b);
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;

  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;
  if (aIsArray) {
    const x = a as unknown[];
    const y = b as unknown[];
    return x.length === y.length && x.every((item, i) => sameValue(item, y[i]));
  }

  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const definedKeys = (record: object) => Object.keys(record).filter(key => field(record, key) !== undefined);
  const aKeys = definedKeys(a);
  if (aKeys.length !== definedKeys(b).length) return false;
  return aKeys.every(key => hasOwn(b, key) && sameValue(field(a, key), field(b, key)));
}

// What the server holds for a car, compared with another copy of it. Like
// sameValue, except that "no pictures" is the same whether it is stored as null
// or as an empty list (the server turns one into the other when it tidies a
// car's photos, and they look identical on screen).
export function sameServerCar(a: unknown, b: unknown): boolean {
  if (sameValue(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const noPictures = (car: object) => {
    const images = field(car, "images");
    return images === null || images === undefined || (Array.isArray(images) && images.length === 0);
  };
  if (!noPictures(a) || !noPictures(b)) return false;
  return sameValue({ ...a, images: null }, { ...b, images: null });
}

export function isEmptyEdit(edit: FieldEdit): boolean {
  return Object.keys(edit.set).length === 0 && edit.unset.size === 0;
}

// What the user changed between two copies of one car: the fields whose value
// differs (and now has one) go in `set`, the fields that were there and now
// aren't go in `unset`. Null when nothing differs. Works on the TOP-LEVEL
// fields only; a changed nested value (the whole `mot`, say) is a changed field.
// `id` is never part of it.
export function diffVehicle(before: Vehicle, after: Vehicle): FieldEdit | null {
  const set: Record<string, unknown> = {};
  const unset = new Set<string>();

  for (const key of Object.keys(after)) {
    if (!isEditableField(key)) continue;
    const now = field(after, key);
    if (now !== undefined && !sameValue(field(before, key), now)) set[key] = now;
  }
  for (const key of Object.keys(before)) {
    if (!isEditableField(key)) continue;
    if (field(before, key) !== undefined && field(after, key) === undefined) unset.add(key);
  }

  const edit: FieldEdit = { set, unset };
  return isEmptyEdit(edit) ? null : edit;
}

// A copy of the car with the edit applied: the `unset` fields removed, then the
// `set` fields put in. Nothing given is changed. The id is always kept.
export function applyEdit(car: Vehicle, edit: FieldEdit): Vehicle {
  const next: Record<string, unknown> = { ...(car as unknown as Record<string, unknown>) };
  for (const key of edit.unset) {
    if (isEditableField(key)) delete next[key];
  }
  for (const key of Object.keys(edit.set)) {
    if (isEditableField(key)) next[key] = edit.set[key];
  }
  return next as unknown as Vehicle;
}

// Folds a newer edit into the one already waiting for the same car. For a field
// named in both, the newer one wins; setting a field un-removes it and removing
// a field un-sets it. Neither input is changed.
export function mergeEdit(pending: FieldEdit | undefined, newer: FieldEdit): FieldEdit {
  const set: Record<string, unknown> = { ...(pending?.set ?? {}) };
  const unset = new Set<string>(pending?.unset ?? []);
  for (const key of Object.keys(newer.set)) {
    set[key] = newer.set[key];
    unset.delete(key);
  }
  for (const key of newer.unset) {
    unset.add(key);
    delete set[key];
  }
  return { set, unset };
}

// What is still waiting after `sent` went to the server and was confirmed: each
// field that is STILL waiting with the value that was sent is done, but a field
// the user changed again while the request was on its way keeps its newer value
// (or its newer removal). Null when nothing is left. Neither input is changed.
export function subtractSent(pending: FieldEdit, sent: FieldEdit): FieldEdit | null {
  const set: Record<string, unknown> = { ...pending.set };
  for (const key of Object.keys(sent.set)) {
    if (hasOwn(set, key) && sameValue(set[key], sent.set[key])) delete set[key];
  }
  const unset = new Set<string>(pending.unset);
  for (const key of sent.unset) unset.delete(key);

  const rest: FieldEdit = { set, unset };
  return isEmptyEdit(rest) ? null : rest;
}

// The edit as the server wants it. An empty half is left out.
export function toWireChange(id: string, edit: FieldEdit): VehicleChange {
  const change: VehicleChange = { id };
  if (Object.keys(edit.set).length > 0) change.set = { ...edit.set };
  if (edit.unset.size > 0) change.unset = [...edit.unset];
  return change;
}

// A car's name for a message: "Ford Fiesta (AB12 CDE)". Null when the record
// has no make, model or registration to name it by.
export function carLabel(car: Vehicle | undefined): string | null {
  if (car === undefined) return null;
  const text = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value).trim() : "");
  const name = [text(field(car, "make")), text(field(car, "model"))].filter(part => part !== "").join(" ");
  const reg = text(field(car, "reg"));
  if (name === "") return reg === "" ? null : reg;
  return reg === "" ? name : `${name} (${reg})`;
}

// Says, in plain words, that edits were dropped because the car no longer
// exists. `labels` has one entry per car: its name, or null when we can't name
// it. Never names the person who deleted it.
export function deletedByOthersNotice(labels: readonly (string | null)[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) {
    const only = labels[0];
    const subject = only === null || only === undefined ? "A car" : `"${only}"`;
    return `${subject} was deleted by someone else, so your change to it wasn't saved.`;
  }
  const named = labels.filter((label): label is string => label !== null).map(label => `"${label}"`);
  const unnamed = labels.length - named.length;
  const parts = unnamed === 0 ? named : [...named, unnamed === 1 ? "another car" : `${unnamed} other cars`];
  const list = parts.length === 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Some cars were deleted by someone else, so your changes to them weren't saved: ${list}.`;
}
