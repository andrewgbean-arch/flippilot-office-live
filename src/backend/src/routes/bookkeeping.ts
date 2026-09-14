import { Express, Request } from "express";
import { readTenantDoc, writeTenantDoc } from "../db";
import type { AuthUser } from "../auth";

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
  app.get("/bookkeeping", (req, res) => {
    const data = readTenantDoc(dealershipId(req), "bookkeeping", EMPTY_BOOKKEEPING);
    res.json({ ok: true, ...EMPTY_BOOKKEEPING, ...data });
  });

  app.put("/bookkeeping", (req, res) => {
    const body = req.body ?? {};
    const data: BookkeepingDoc = {
      costs: Array.isArray(body.costs) ? body.costs : [],
      purchases: Array.isArray(body.purchases) ? body.purchases : [],
      sales: Array.isArray(body.sales) ? body.sales : [],
      transactions: Array.isArray(body.transactions) ? body.transactions : [],
      suppliers: Array.isArray(body.suppliers) ? body.suppliers : [],
      categories: Array.isArray(body.categories) ? body.categories : [],
    };
    writeTenantDoc(dealershipId(req), "bookkeeping", data);
    res.json({ ok: true, ...data });
  });
}
