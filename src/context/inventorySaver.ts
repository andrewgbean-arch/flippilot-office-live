import type { Vehicle } from "../types/Vehicle";
import {
  applyEdit,
  carLabel,
  deletedByOthersNotice,
  diffVehicle,
  mergeEdit,
  sameServerCar,
  sameValue,
  subtractSent,
  toWireChange,
  type FieldEdit,
  type SavePayload,
} from "./inventoryChanges";

// Saving stock from the web app — the client's half of the server's contract
// (see routes/inventory.ts on the server, and inventoryChanges.ts for the wire
// types and the pure rules).
//
// What goes to the server is only what THIS screen's user changed:
//   - cars created here that the server hasn't confirmed yet: whole records;
//   - for cars that already exist: field-level edits (`changes`), which the
//     server applies onto its CURRENT copy, so another person's edit to a
//     different field of the same car survives, and an edit can never bring a
//     deleted car back;
//   - the ids of cars the user deliberately deleted (`deletedIds`).
// A car that merely isn't in a saved list is never removed.
//
// The screen shows (the last list the server gave us) + (this user's unsent
// edits). Those unsent edits are an explicit OVERLAY, recorded only inside
// `change()`, and never worked out by comparing what's on screen with what the
// server holds. That is the whole point: after a save the server's copy of a car
// can carry OTHER people's edits this screen lacks, and a later diff must never
// read "the screen lacks their edit" as "the user changed it back".
//
// This file is deliberately free of React and fetch so the rules can be tested
// on their own. It is responsible for:
//   - remembering what the user has added, changed and deleted that the server
//     hasn't yet confirmed, sending it, and forgetting each piece ONLY once the
//     server has confirmed exactly that piece (an edit made while a save was on
//     its way stays waiting for the next one);
//   - sending one save at a time (a follow-up for anything changed meanwhile),
//     so requests can't overtake each other;
//   - taking in the list the server answers with (it can hold cars added, edited
//     or deleted elsewhere) WITHOUT discarding what the user did in the meantime;
//   - saying so, once, when an edit was dropped because someone else deleted the
//     car;
//   - keeping everything when a save fails, so it can simply be tried again.
//
// Deliberate limits: two people changing the SAME field of one car — the later
// save wins that field; and `costs`/`images`/`mot` are replaced as a whole field.

export type SaveResult =
  // `notFound`: ids of cars the user had edited that the server no longer has
  // (deleted elsewhere). Nothing was created for them.
  | { ok: true; items: Vehicle[]; notFound?: string[] }
  | { ok: false; status: number | null; message: string };

export interface SaverStatus {
  saving: boolean; // a save is on its way
  error: string | null; // why the latest save failed (null when it didn't)
  unsaved: boolean; // there are changes the server hasn't confirmed
  // A plain-words heads-up the user should read (an edit of theirs was dropped
  // because someone else deleted the car). Stays until they dismiss it or a
  // newer one is added to it; a later successful save does NOT clear it.
  notice: string | null;
}

export function sameStatus(a: SaverStatus, b: SaverStatus): boolean {
  return a.saving === b.saving && a.error === b.error && a.unsaved === b.unsaved && a.notice === b.notice;
}

// Taken when a read of the stock starts; a result is only adopted if nothing
// has been edited (and nobody has logged in or out) since.
export interface ReadStamp {
  epoch: number;
  version: number;
}

const SAVE_FAILED = "We couldn't save your latest changes to stock. Check your connection and try again.";

// A car's id, or null when it has none that can tell it apart from another
// (the server keeps whatever it once stored; such an entry can be shown but
// never edited, added or deleted by id).
function idOf(vehicle: unknown): string | null {
  const id = (vehicle as { id?: unknown } | null)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function sameList(a: readonly Vehicle[], b: readonly Vehicle[]): boolean {
  return a.length === b.length && a.every((vehicle, i) => vehicle === b[i]);
}

export interface InventorySaverOptions {
  // Sends what changed (see SavePayload). Should report failure as a result
  // rather than throw (a throw is treated as a failed save).
  send: (payload: SavePayload) => Promise<SaveResult>;
  // Readies the server's cars for display (the AI enrichment). May throw.
  prepare?: (vehicles: Vehicle[]) => Vehicle[];
  // The list on screen changed (the saver is the only thing that changes it).
  onVehicles: (vehicles: Vehicle[]) => void;
  onStatus: (status: SaverStatus) => void;
}

export interface InventorySaver {
  // A different login (or none): forget everything, drop any save still on
  // its way, and show an empty stock. Nothing is saved until `loaded`.
  reset(): void;
  // True once the stock has been loaded successfully for this login: only
  // then is the list real, and only then is anything saved.
  isReady(): boolean;
  getList(): Vehicle[];
  // The first successful read for this login. Throws (changing nothing) if
  // `prepare` does.
  loaded(serverList: Vehicle[]): void;
  // The user changed the stock: `next` is the whole new list (worked out from
  // the one on screen), and `deletedId` names a car they deliberately deleted.
  // Records what differs and saves it. A call that changes nothing sends
  // nothing.
  change(next: Vehicle[], deletedId?: string): Promise<void>;
  // Try again (or just sync): sends whatever is unconfirmed (nothing, if
  // nothing is) and adopts what the server answers with.
  retry(): Promise<void>;
  // Changes the server hasn't confirmed yet (including ones whose save failed).
  hasUnsaved(): boolean;
  stamp(): ReadStamp;
  // Adopts a later read of the stock, unless it can't be trusted to be newer
  // than what's on screen. Returns whether it was adopted.
  adoptRefresh(stamp: ReadStamp, serverList: Vehicle[]): boolean;
  // The user has read the notice.
  dismissNotice(): void;
}

export function createInventorySaver(options: InventorySaverOptions): InventorySaver {
  let epoch = 0; // bumped by reset(): results from an earlier login are ignored
  let version = 0; // counts changes the user has made
  let confirmedVersion = 0; // the latest of those the server has confirmed
  let ready = false;
  let list: Vehicle[] = []; // what is on screen: the server's cars + the unsent edits below

  // The last raw copy of each car the server gave us (no preparing, no unsent
  // edits): what tells "the server's copy changed" from "it's what we had".
  const known = new Map<string, Vehicle>();

  // The overlay: what the user did here that the server hasn't confirmed.
  const pendingAdded = new Map<string, Vehicle>(); // created here: whole records
  const pendingChanges = new Map<string, FieldEdit>(); // edits of cars that exist
  const pendingDeleted = new Set<string>(); // deleted here

  // Names of cars that left the screen while an edit of theirs was still
  // waiting, so the notice can still name them when the server says so. Only
  // ever a few short strings; emptied with the login.
  const leftScreen = new Map<string, string>();
  // The cars the notice is about (id -> name, or null when it had none).
  const noticeCars = new Map<string, string | null>();
  let notice: string | null = null;

  let inFlight = false;
  let current: Promise<void> | null = null;
  let again = false; // something changed while a save was in flight
  let error: string | null = null;
  let lastStatus: SaverStatus | null = null;

  function publish() {
    const status: SaverStatus = { saving: inFlight, error, unsaved: ready && version > confirmedVersion, notice };
    if (lastStatus !== null && sameStatus(lastStatus, status)) return;
    lastStatus = status;
    options.onStatus(status);
  }

  function setList(next: Vehicle[]) {
    list = next;
    options.onVehicles(next);
  }

  function prepared(vehicles: Vehicle[]): Vehicle[] {
    return options.prepare ? options.prepare(vehicles) : vehicles;
  }

  function rememberServerCars(serverList: readonly Vehicle[]) {
    known.clear();
    for (const car of serverList) {
      const id = idOf(car);
      if (id !== null && !known.has(id)) known.set(id, car);
    }
  }

  // Works out what the user just did, from the list they were looking at
  // (`list`) and the one they made from it (`next`), and adds it to the
  // overlay. Returns whether it recorded anything.
  function record(next: readonly Vehicle[], deletedId: string | undefined): boolean {
    let recorded = false;

    const before = new Map<string, Vehicle>();
    for (const vehicle of list) {
      const id = idOf(vehicle);
      if (id !== null && !before.has(id)) before.set(id, vehicle);
    }

    const inNext = new Set<string>();
    for (const car of next) {
      const id = idOf(car);
      if (id === null || inNext.has(id)) continue;
      inNext.add(id);

      const previous = before.get(id);
      if (previous === undefined) {
        // Not on screen before: the user created it.
        pendingAdded.set(id, car);
        recorded = true;
      } else if (previous !== car) {
        if (pendingAdded.has(id)) {
          // Still waiting to be created: the whole record is replaced, not
          // edited (the server hasn't got anything to apply an edit to).
          const changed = !sameValue(pendingAdded.get(id), car);
          pendingAdded.set(id, car);
          if (changed) recorded = true;
        } else {
          const difference = diffVehicle(previous, car);
          if (difference !== null) {
            pendingChanges.set(id, mergeEdit(pendingChanges.get(id), difference));
            recorded = true;
          }
        }
      }
    }

    // A car that isn't in `next` is only deleted if the caller says it was
    // deliberately deleted. Absence alone never deletes: the list may just be
    // out of date, and the server's list brings the car back.
    if (deletedId !== undefined && !inNext.has(deletedId)) {
      pendingAdded.delete(deletedId);
      pendingChanges.delete(deletedId);
      pendingDeleted.add(deletedId);
      recorded = true;
    }
    return recorded;
  }

  // Builds the list to show from the server's: the server's cars, in its order,
  // each with this user's unsent edit put back on top, then the cars created here
  // that the server hasn't got yet. A car whose server copy is what we last saw
  // keeps the very object that's on screen (it already IS that copy plus the
  // unsent edit), so nothing changes for it. Changes nothing until it has
  // finished: if preparing a car throws, the screen and the records are exactly
  // as they were.
  function adopt(serverItems: readonly Vehicle[]) {
    const onScreen = new Map<string, Vehicle>();
    const unnamed: Vehicle[] = []; // on-screen entries with no usable id
    for (const vehicle of list) {
      const id = idOf(vehicle);
      if (id === null) unnamed.push(vehicle);
      else if (!onScreen.has(id)) onScreen.set(id, vehicle);
    }

    const next: Vehicle[] = [];
    const nextKnown: Vehicle[] = [];
    const inNext = new Set<string>();
    const seen = new Set<string>();

    for (const server of serverItems) {
      const id = idOf(server);
      if (id === null || seen.has(id)) {
        // Can't be told apart from another car, so it can't be tracked: show
        // it, and keep the object that's already on screen for it if it is the
        // same, so it doesn't make the whole list look new every time.
        const [made] = prepared([server]);
        if (made === undefined) continue;
        const twin = unnamed.findIndex(vehicle => sameValue(vehicle, made));
        next.push(twin >= 0 ? unnamed.splice(twin, 1)[0]! : made);
        continue;
      }
      seen.add(id);
      nextKnown.push(server);
      if (pendingDeleted.has(id)) continue; // deleted here; its deletion is still on its way

      const mine = onScreen.get(id);
      if (mine !== undefined && sameServerCar(known.get(id), server)) {
        next.push(mine);
        inNext.add(id);
        continue;
      }
      const createdHere = pendingAdded.get(id);
      if (createdHere !== undefined) {
        next.push(createdHere);
        inNext.add(id);
        continue;
      }
      const [made] = prepared([server]);
      if (made === undefined) continue;
      const unsent = pendingChanges.get(id);
      next.push(unsent === undefined ? made : applyEdit(made, unsent));
      inNext.add(id);
    }

    for (const [id, car] of pendingAdded) {
      if (!inNext.has(id) && !pendingDeleted.has(id)) next.push(car);
    }

    // Preparing worked; now it's safe to change things.
    for (const [id, mine] of onScreen) {
      const label = carLabel(mine);
      if (!inNext.has(id) && pendingChanges.has(id) && label !== null) leftScreen.set(id, label);
    }
    rememberServerCars(nextKnown);
    // Only replace the list if something on it is different: a save that
    // taught us nothing must not make the screen churn.
    if (!sameList(list, next)) setList(next);
  }

  // Takes in the server's answer to a save. The save itself worked; if showing
  // what came back fails, that is only logged.
  function adoptSaved(serverItems: Vehicle[]) {
    try {
      adopt(serverItems);
    } catch (err) {
      console.error("Inventory saved, but the server's list couldn't be prepared for display:", err);
    }
  }

  // The server has confirmed a request: forget exactly what it carried, and
  // nothing more. Whatever the user did while it was on its way stays waiting.
  function confirm(
    sentAdded: ReadonlyMap<string, Vehicle>,
    sentChanges: ReadonlyMap<string, FieldEdit>,
    sentDeleted: readonly string[],
    notFound: readonly string[]
  ) {
    for (const id of sentDeleted) pendingDeleted.delete(id);

    for (const [id, sentCar] of sentAdded) {
      const now = pendingAdded.get(id);
      if (now !== undefined && now !== sentCar) {
        // Edited again while it was on its way: the server now holds the sent
        // version, so what's left to send is only the difference.
        const difference = diffVehicle(sentCar, now);
        if (difference !== null) pendingChanges.set(id, mergeEdit(pendingChanges.get(id), difference));
      }
      // (Deleted meanwhile: nothing to do, its deletion is already waiting.)
      pendingAdded.delete(id);
      known.set(id, sentCar); // the server now holds the version we sent
    }

    // Only a car we sent an edit for can be "not found".
    const missing = new Set(notFound.filter(id => sentChanges.has(id)));
    for (const [id, sentEdit] of sentChanges) {
      const waiting = pendingChanges.get(id);
      if (waiting !== undefined) {
        const rest = subtractSent(waiting, sentEdit);
        if (rest === null) pendingChanges.delete(id);
        else pendingChanges.set(id, rest);
      }
      const base = known.get(id);
      // The server now holds its copy plus what we sent (unless the car wasn't
      // there). Expecting that lets the reply be recognised as "nothing new".
      if (base !== undefined && !missing.has(id)) known.set(id, applyEdit(base, sentEdit));
    }

    // Cars someone else deleted: our edit has nothing to apply to. Drop it
    // (the car leaves the screen when the list is adopted) and say so.
    const dropped: [string, string | null][] = [];
    for (const id of missing) {
      if (pendingDeleted.has(id)) continue; // deleted here too: nothing to tell them
      dropped.push([id, carLabel(list.find(vehicle => idOf(vehicle) === id)) ?? leftScreen.get(id) ?? null]);
    }
    for (const id of missing) pendingChanges.delete(id);
    if (dropped.length > 0) {
      for (const [id, label] of dropped) noticeCars.set(id, label);
      notice = deletedByOthersNotice([...noticeCars.values()]);
    }
  }

  async function runSaves(myEpoch: number): Promise<void> {
    publish();
    try {
      do {
        again = false;
        const sentVersion = version;
        const sentAdded = new Map(pendingAdded);
        const sentChanges = new Map(pendingChanges);
        const sentDeleted = [...pendingDeleted];
        const payload: SavePayload = {
          items: [...sentAdded.values()],
          changes: [...sentChanges].map(([id, edit]) => toWireChange(id, edit)),
          deletedIds: sentDeleted,
        };

        let result: SaveResult;
        try {
          result = await options.send(payload);
        } catch (err) {
          console.error("Inventory save threw:", err);
          result = { ok: false, status: null, message: SAVE_FAILED };
        }
        if (myEpoch !== epoch) return; // the login changed while this was on its way

        if (!result.ok) {
          // Everything stays as it is — the list, everything unconfirmed — so
          // the next attempt sends it all again. No retry loop here: the next
          // edit, or the user, tries again.
          error = result.message;
          return;
        }

        error = null;
        confirm(sentAdded, sentChanges, sentDeleted, result.notFound ?? []);
        confirmedVersion = Math.max(confirmedVersion, sentVersion);
        adoptSaved(result.items);
        publish(); // a follow-up may be next; don't keep a notice waiting for it
      } while (again);
    } finally {
      if (myEpoch === epoch) {
        inFlight = false;
        current = null;
        publish();
      }
    }
  }

  function save(): Promise<void> {
    if (!ready) return Promise.resolve();
    if (inFlight) {
      again = true; // one at a time; whatever changed goes in the next request
      return current ?? Promise.resolve();
    }
    inFlight = true;
    current = runSaves(epoch);
    return current;
  }

  return {
    reset() {
      epoch += 1;
      version = 0;
      confirmedVersion = 0;
      ready = false;
      inFlight = false;
      current = null;
      again = false;
      error = null;
      known.clear();
      pendingAdded.clear();
      pendingChanges.clear();
      pendingDeleted.clear();
      leftScreen.clear();
      noticeCars.clear();
      notice = null;
      lastStatus = null;
      setList([]);
      publish();
    },

    isReady: () => ready,
    getList: () => list,

    loaded(serverList) {
      const next = prepared(serverList);
      rememberServerCars(serverList);
      list = next;
      ready = true;
      confirmedVersion = version;
      options.onVehicles(next);
      publish();
    },

    change(next, deletedId) {
      if (!ready) {
        // Not this login's real stock: show it, but never save it.
        setList(next);
        return Promise.resolve();
      }
      const recorded = record(next, deletedId);
      if (!sameList(list, next)) setList(next);
      if (!recorded) return Promise.resolve(); // nothing to tell the server
      version += 1;
      publish();
      return save();
    },

    retry: save,

    hasUnsaved: () => ready && version > confirmedVersion,

    stamp: () => ({ epoch, version }),

    adoptRefresh(stamp, serverList) {
      if (!ready || stamp.epoch !== epoch) return false;
      // Edited since the read began, or changes still waiting to be saved
      // or on their way: the server's copy may be older than what's on screen.
      if (stamp.version !== version || version !== confirmedVersion || inFlight) return false;
      adopt(serverList);
      return true;
    },

    dismissNotice() {
      noticeCars.clear();
      notice = null;
      publish();
    },
  };
}
