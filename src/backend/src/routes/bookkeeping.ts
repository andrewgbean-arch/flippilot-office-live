import { Express, Request } from "express";
import { readTenantCollection, readTenantDoc, writeTenantCollection, writeTenantDoc } from "../db";
import { requireStaffRole, type AuthUser } from "../auth";
import { bookkeepingDocFromBody } from "../wholeListGuard";
import { keepVoidedSales } from "../saleVoids";
import { mergeLedger, removedFromBody } from "../bookkeepingMerge";
import type { BookkeepingList } from "../wholeListGuard";

// Ids of ledger entries deliberately deleted (only costs can be), so an
// out-of-date screen can never save them back (bookkeepingMerge.ts).
const DELETED = "bookkeepingDeleted";
type DeletedEntry = { list: BookkeepingList; id: string; at: string };

function dealershipId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.dealershipId;
}

interface BookkeepingDoc {
  costs: unknown[];
  purchases: unknown[];
  sales: unknown[];
  transactions: unknown[];
  suppliers: unknown[];
  categories: unknown[];
}

const EMPTY_BOOKKEEPING: BookkeepingDoc = {
  costs: [],
  purchases: [],
  sales: [],
  transactions: [],
  suppliers: [],
  categories: [],
};

// Was pure localStorage (BookkeepingProvider.tsx) — a dealer's purchase/
// cost/sale records never left the one browser they were entered in,
// with no backup and no visibility from a second device. Scoped per
// dealership — one dealer's books are never visible to another
// (requireAuth runs before this in server.ts), same as inventory/leads/
// staff. Stored as a single combined document rather than separate
// array collections since BookkeepingProvider already treats these six
// fields as one cohesive record.
export default function registerBookkeepingRoute(app: Express) {
  // The ledger (what every car cost, every sale, every general transaction,
  // wages included if a dealer records them here) is for the owner, managers
  // and finance: the same people who write it.
  app.get("/bookkeeping", requireStaffRole("finance", "manager"), (req, res) => {
    const data = readTenantDoc(dealershipId(req), "bookkeeping", EMPTY_BOOKKEEPING);
    res.json({ ok: true, ...EMPTY_BOOKKEEPING, ...data });
  });

  // Recording purchases/costs/sales/VAT is finance/manager/owner
  // territory, like reading them.
  app.put("/bookkeeping", requireStaffRole("finance", "manager"), (req, res) => {
    // A whole-ledger replace: every list must actually be in the request,
    // or a partial or broken body would blank the ones it left out.
    const sent = bookkeepingDocFromBody(req, res);
    if (!sent) return;
    const d = dealershipId(req);
    const stored = readTenantDoc<Partial<BookkeepingDoc>>(d, "bookkeeping", EMPTY_BOOKKEEPING);

    // Merged into what is stored, entry by entry, so a colleague's entries made
    // since this screen loaded are kept (bookkeepingMerge.ts). Deletions are only
    // what the save names, and are remembered.
    const removed = removedFromBody(req.body);
    const deletedLog = readTenantCollection<DeletedEntry>(d, DELETED);
    const deletedBefore: Partial<Record<BookkeepingList, Set<string>>> = {};
    for (const e of deletedLog) (deletedBefore[e.list] ??= new Set()).add(e.id);
    const data = mergeLedger(stored, sent, removed, deletedBefore);
    // Voiding a sale is one way: an out-of-date screen can't undo it (saleVoids.ts).
    data.sales = keepVoidedSales(stored.sales, data.sales);

    const now = new Date().toISOString();
    const newlyDeleted = Object.entries(removed).flatMap(([list, ids]) =>
      (ids ?? []).filter((id) => !deletedBefore[list as BookkeepingList]?.has(id)).map((id) => ({ list: list as BookkeepingList, id, at: now }))
    );
    if (newlyDeleted.length > 0) writeTenantCollection(d, DELETED, [...deletedLog, ...newlyDeleted]);
    writeTenantDoc(d, "bookkeeping", data);
    // The merged ledger goes back, so the screen can show entries others added.
    res.json({ ok: true, ...data });
  });
}
