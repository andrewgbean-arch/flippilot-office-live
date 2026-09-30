import { BOOKKEEPING_LISTS, type BookkeepingList } from "./wholeListGuard";

// Two people using Books at once. Every save sends the WHOLE ledger, so a screen
// loaded before a colleague recorded a sale, a cost or a purchase used to save
// its older copy over the top, and the colleague's entry was gone without a word.
//
// A save is now MERGED into what is stored, entry by entry (every entry has an id):
// - an entry the save has is taken from the save (it may be an edit);
// - an entry only the stored ledger has is KEPT (someone else added it);
// - an entry is dropped only when the save says it deleted it (`removed`), and
//   that is remembered, so an out-of-date screen that still holds it can't bring
//   it back. Only costs can be deleted in Books (a sale is voided instead, see
//   saleVoids.ts; purchases are corrected, not deleted), so only `removed.costs`
//   is accepted.
// Entries without an id (never written by the app) are passed through as sent.

type Rec = Record<string, unknown>;
export type Ledger = Record<BookkeepingList, Rec[]>;
export type Removed = Partial<Record<BookkeepingList, string[]>>;

const DELETABLE: readonly BookkeepingList[] = ["costs"];

const idOf = (e: unknown): string | null => {
  const id = (e as { id?: unknown } | null)?.id;
  return typeof id === "string" && id ? id : null;
};

/** The ids a save may say it deleted, per list: only lists that can be deleted from, only strings. */
export function removedFromBody(body: unknown): Removed {
  const raw = (body as { removed?: unknown } | null)?.removed;
  const out: Removed = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const list of DELETABLE) {
    const ids = (raw as Record<string, unknown>)[list];
    if (Array.isArray(ids)) out[list] = ids.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 200);
  }
  return out;
}

export function mergeLedger(
  stored: Partial<Record<BookkeepingList, unknown>>,
  incoming: Ledger,
  removed: Removed,
  deletedBefore: Partial<Record<BookkeepingList, ReadonlySet<string>>>
): Ledger {
  const out = {} as Ledger;
  for (const list of BOOKKEEPING_LISTS) {
    const gone = new Set<string>([...(removed[list] ?? []), ...(deletedBefore[list] ?? [])]);
    const fromSave = incoming[list].filter((e) => {
      const id = idOf(e);
      return id === null || !gone.has(id);
    });
    const inSave = new Set(fromSave.map(idOf).filter((id): id is string => id !== null));
    const storedList = Array.isArray(stored[list]) ? (stored[list] as unknown[]) : [];
    const keptFromStore = storedList.filter((e): e is Rec => {
      const id = idOf(e);
      return id !== null && !inSave.has(id) && !gone.has(id);
    });
    out[list] = [...fromSave, ...keptFromStore];
  }
  return out;
}
