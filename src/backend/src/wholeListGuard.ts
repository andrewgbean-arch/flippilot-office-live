import type { Request, Response } from "express";

// The routes that REPLACE a dealership's whole list (PUT /leads, /jobs,
// /staff, /contacts, /consumables, /customers, /work-patterns, /shifts) or
// whole document (PUT /bookkeeping) with whatever the request holds.
//
// They used to coerce a missing or wrongly-typed body to [] and write it,
// so a broken request (a body the JSON parser skipped, a client bug that
// sent {}, an old tab that sent the wrong field name) answered 200 and
// quietly erased the dealer's real data. A replace is only safe when the
// caller really sent a list, so anything else is refused with a 400 and
// nothing is written. A genuinely empty list is still a valid list.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const NOT_SAVED = "nothing was saved";

// The list of records in `{ items: [...] }`, or null after answering 400.
// Callers do `const items = itemsFromBody(req, res); if (!items) return;`.
// The records are only checked to BE objects, not for their fields (the
// routes have never validated those), so T is the caller's own claim.
export function itemsFromBody<T extends object = Record<string, unknown>>(req: Request, res: Response): T[] | null {
  const items: unknown = req.body?.items;
  if (!Array.isArray(items)) {
    res.status(400).json({ ok: false, error: `items must be an array — ${NOT_SAVED}` });
    return null;
  }
  // A null or a bare string inside the list would be stored as-is and then
  // crash every later read that looks at item.id.
  if (!items.every(isRecord)) {
    res.status(400).json({ ok: false, error: `every item must be an object — ${NOT_SAVED}` });
    return null;
  }
  return items as T[];
}

// PUT /bookkeeping replaces the whole ledger, so a partial body must not
// turn the lists it left out into empty ones.
export const BOOKKEEPING_LISTS = ["costs", "purchases", "sales", "transactions", "suppliers", "categories"] as const;
export type BookkeepingList = (typeof BOOKKEEPING_LISTS)[number];
export type BookkeepingDocFromBody = Record<BookkeepingList, Record<string, unknown>[]>;

// All six lists, each an array of records, or null after answering 400.
export function bookkeepingDocFromBody(req: Request, res: Response): BookkeepingDocFromBody | null {
  const body: unknown = req.body;
  if (!isRecord(body)) {
    res.status(400).json({ ok: false, error: `the whole ledger must be sent — ${NOT_SAVED}` });
    return null;
  }
  const doc = {} as BookkeepingDocFromBody;
  for (const name of BOOKKEEPING_LISTS) {
    const list = body[name];
    if (!Array.isArray(list)) {
      res.status(400).json({ ok: false, error: `${name} must be an array — ${NOT_SAVED}` });
      return null;
    }
    if (!list.every(isRecord)) {
      res.status(400).json({ ok: false, error: `every entry in ${name} must be an object — ${NOT_SAVED}` });
      return null;
    }
    doc[name] = list;
  }
  return doc;
}
