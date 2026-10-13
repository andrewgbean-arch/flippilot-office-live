import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import { itemsFromBody } from "../wholeListGuard";
import type { AuthUser } from "../auth";
import { canDeleteLeads, droppedIds } from "../roleAccess";
import { putInBin, removedRecords, tooManyRemoved, tooManyRemovedMessage } from "../recycleBin";
import { withoutErased } from "../customerData";
import { canSeeLeadFinances, keepStoredLeadFinances, withoutLeadFinances } from "../leadFinance";

function dealershipId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.dealershipId;
}

// Scoped per-dealership — one dealer's leads are never visible to
// another (requireAuth runs before this in server.ts).
export default function registerLeadsRoute(app: Express) {
  app.get("/leads", (req, res) => {
    const user = (req as Request & { user: AuthUser }).user;
    const items = readTenantCollection<unknown>(dealershipId(req), "leads");
    // A buyer's income, credit score and savings are for the people who have the finance
    // conversation (leadFinance.ts).
    res.json({ ok: true, items: canSeeLeadFinances(user) ? items : withoutLeadFinances(items) });
  });

  // Every save sends the whole list, so a lead missing from it is a lead
  // being removed: only sales, managers and the owner may do that.
  app.put("/leads", (req, res) => {
    const sent = itemsFromBody(req, res);
    if (!sent) return;
    const user = (req as Request & { user: AuthUser }).user;
    // A lead erased at a customer's request never comes back from an old screen (customerData.ts).
    const before = readTenantCollection<unknown>(user.dealershipId, "leads");
    // An account that is not shown the money details cannot change or wipe them by saving the list.
    const received = canSeeLeadFinances(user) ? sent : keepStoredLeadFinances(sent, before);
    const items = withoutErased(user.dealershipId, "leads", received);
    if (!canDeleteLeads(user) && droppedIds(before, items).length > 0) {
      return res.status(403).json({ ok: false, error: "Only sales, managers and the owner can remove a lead. Nothing was saved." });
    }
    // The app removes one at a time; more than that is an out-of-date or broken screen (recycleBin.ts).
    const tooMany = tooManyRemoved("leads", before, items);
    if (tooMany !== null) return res.status(409).json({ ok: false, error: tooManyRemovedMessage("leads", tooMany) });
    putInBin(user, "leads", removedRecords(before, items));
    writeTenantCollection(dealershipId(req), "leads", items);
    res.json({ ok: true, items: canSeeLeadFinances(user) ? items : withoutLeadFinances(items) });
  });
}
