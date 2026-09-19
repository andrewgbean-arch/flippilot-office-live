import type { Vehicle } from "../types/Vehicle";

// Saving stock from the web app — the client's half of the server's contract.
//
// The server treats a save as an UPSERT (routes/inventory.ts): the cars sent
// are added or replace the ones with the same id, cars it holds that weren't
// sent are KEPT, and only ids listed in `deletedIds` are removed. It answers
// with the whole list as it now stands.
//
// This file is deliberately free of React and fetch so the rules can be tested
// on their own. It is responsible for:
//   - remembering which cars the user has deleted that the server hasn't yet
//     confirmed, sending them, and forgetting them ONLY once it has;
//   - sending one save at a time (a follow-up for anything changed meanwhile),
//     so requests can't overtake each other;
//   - taking in the list the server answers with (it can hold cars added
//     elsewhere) WITHOUT discarding edits made while that save was in flight;
//   - keeping everything when a save fails, so it can simply be tried again.

export type SaveResult =
  | { ok: true; items: Vehicle[] }
  | { ok: false; status: number | null; message: string };

export interface SaverStatus {
  saving: boolean; // a save is on its way
  error: string | null; // why the latest save failed (null when it didn't)
  unsaved: boolean; // there are changes the server hasn't confirmed
}

export function sameStatus(a: SaverStatus, b: SaverStatus): boolean {
  return a.saving === b.saving && a.error === b.error && a.unsaved === b.unsaved;
}

// Taken when a read of the stock starts; a result is only adopted if nothing
// has been edited (and nobody has logged in or out) since.
export interface ReadStamp {
  epoch: number;
  version: number;
}

const SAVE_FAILED = "We couldn't save your latest changes to stock. Check your connection and try again.";

// Cars the server holds that this screen doesn't have — added by someone else
// since it loaded — leaving out any the user has deleted here that the server
// hasn't yet been told about (their deletion is still on its way).
export function carsNewFromServer(
  server: readonly Vehicle[],
  local: readonly Vehicle[],
  pendingDeleted: ReadonlySet<string>
): Vehicle[] {
  const onScreen = new Set(local.map(v => v.id));
  return server.filter(v => !onScreen.has(v.id) && !pendingDeleted.has(v.id));
}

function sameImages(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  const x = a ?? []; // no pictures is null on the server and can be [] here
  const y = b ?? [];
  return x.length === y.length && x.every((url, i) => url === y[i]);
}

// True when the server's list is what's already on screen as far as the
// server can change it: the same cars, in the same order, with the same
// pictures. Lets a save that learnt nothing new leave the screen alone.
export function sameStock(server: readonly Vehicle[], local: readonly Vehicle[]): boolean {
  return (
    server.length === local.length &&
    server.every((v, i) => {
      const mine = local[i];
      return mine !== undefined && mine.id === v.id && sameImages(v.images, mine.images);
    })
  );
}

export interface InventorySaverOptions {
  // Sends the whole list and the ids deleted since the last confirmed save.
  // Should report failure as a result rather than throw (a throw is treated as
  // a failed save).
  send: (vehicles: Vehicle[], deletedIds: string[]) => Promise<SaveResult>;
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
  // The user changed the stock: `next` is the whole new list, and
  // `deletedId` names a car they deliberately deleted. Saves it.
  change(next: Vehicle[], deletedId?: string): Promise<void>;
  // Try again (or just sync): sends the current list and any unconfirmed
  // deletions, and adopts what the server answers with.
  retry(): Promise<void>;
  // Changes the server hasn't confirmed yet (including ones whose save failed).
  hasUnsaved(): boolean;
  stamp(): ReadStamp;
  // Adopts a later read of the stock, unless it can't be trusted to be newer
  // than what's on screen. Returns whether it was adopted.
  adoptRefresh(stamp: ReadStamp, serverList: Vehicle[]): boolean;
}

export function createInventorySaver(options: InventorySaverOptions): InventorySaver {
  let epoch = 0; // bumped by reset(): results from an earlier login are ignored
  let version = 0; // counts changes the user has made
  let confirmedVersion = 0; // the latest of those the server has confirmed
  let ready = false;
  let list: Vehicle[] = [];
  const pendingDeleted = new Set<string>(); // deleted here, not yet confirmed
  let inFlight = false;
  let current: Promise<void> | null = null;
  let again = false; // something changed while a save was in flight
  let error: string | null = null;
  let lastStatus: SaverStatus | null = null;

  function publish() {
    const status: SaverStatus = { saving: inFlight, error, unsaved: ready && version > confirmedVersion };
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

  // Takes in the server's answer to a save. If nothing was edited while it
  // was on its way, the server's list simply IS the stock now. If the user
  // kept editing, what's on screen is newer than what the server echoed, so
  // it stays exactly as it is and only cars from elsewhere are added.
  function adoptSaved(serverItems: Vehicle[], editedSinceSent: boolean) {
    try {
      if (!editedSinceSent) {
        if (!sameStock(serverItems, list)) setList(prepared(serverItems));
        return;
      }
      const added = carsNewFromServer(serverItems, list, pendingDeleted);
      if (added.length > 0) setList([...list, ...prepared(added)]);
    } catch (err) {
      // The save itself worked; only showing what came back failed.
      console.error("Inventory saved, but the server's list couldn't be prepared for display:", err);
    }
  }

  async function runSaves(myEpoch: number): Promise<void> {
    publish();
    try {
      do {
        again = false;
        const sentVersion = version;
        const sentList = list;
        const sentDeleted = [...pendingDeleted];

        let result: SaveResult;
        try {
          result = await options.send(sentList, sentDeleted);
        } catch (err) {
          console.error("Inventory save threw:", err);
          result = { ok: false, status: null, message: SAVE_FAILED };
        }
        if (myEpoch !== epoch) return; // the login changed while this was on its way

        if (!result.ok) {
          // Everything stays as it is — the list, the unconfirmed deletions —
          // so the next attempt sends it all again. No retry loop here: the
          // next edit, or the user, tries again.
          error = result.message;
          return;
        }

        error = null;
        for (const id of sentDeleted) pendingDeleted.delete(id); // confirmed
        confirmedVersion = Math.max(confirmedVersion, sentVersion);
        adoptSaved(result.items, version !== sentVersion);
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
      pendingDeleted.clear();
      lastStatus = null;
      setList([]);
      publish();
    },

    isReady: () => ready,
    getList: () => list,

    loaded(serverList) {
      const next = prepared(serverList);
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
      version += 1;
      if (deletedId !== undefined) pendingDeleted.add(deletedId);
      setList(next);
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
      setList(prepared(serverList));
      return true;
    },
  };
}
