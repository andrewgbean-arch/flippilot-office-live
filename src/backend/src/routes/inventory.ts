import { Express, Request } from "express";
import { deleteVehiclePhotosFor, readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";
import { mergeVehicleSave, parseDeletedIds } from "../inventoryMerge";
import { keepHostedPhotos, publicOrigin } from "./photos";

function dealershipId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.dealershipId;
}

// Was hardcoded mock data (Ford Fiesta / BMW 1 Series), then a single
// shared file for every dealer — now scoped per-dealership so one
// dealer's inventory is never visible to another (requireAuth runs
// before this in server.ts, so req.user is always populated here).
export default function registerInventoryRoute(app: Express) {
  app.get("/inventory", (req, res) => {
    res.json({ ok: true, items: readTenantCollection(dealershipId(req), "vehicles") });
  });

  // Saving is an UPSERT (see inventoryMerge.ts), not a replace:
  //   { items: [...], deletedIds?: [...] }
  // The cars in `items` are added or replace the ones with the same id; cars
  // the server has that aren't in `items` are left alone (the sender's list
  // may simply predate them); only ids in `deletedIds` are removed, together
  // with their hosted pictures. Answers with the full list as it now stands
  // so the sender can catch up on anything it hadn't seen.
  // Older clients that send a whole list keep working — they just can't
  // delete anything.
  app.put("/inventory", (req, res) => {
    const id = dealershipId(req);
    const body: unknown = req.body;
    const items = body && typeof body === "object" ? (body as { items?: unknown }).items : undefined;

    // A missing or malformed list must be refused, not read as "no cars":
    // a wrong content-type or a client bug would otherwise wipe the stock.
    if (!Array.isArray(items)) {
      return res.status(400).json({ ok: false, error: "Send your stock as { items: [...] }" });
    }
    const deleted = parseDeletedIds((body as { deletedIds?: unknown }).deletedIds);
    if (!deleted.ok) {
      return res.status(400).json({ ok: false, error: deleted.error });
    }

    // Photos added from a phone survive a save from a screen that hadn't
    // seen them yet (see keepHostedPhotos).
    const sent = keepHostedPhotos(id, items, publicOrigin(req));
    const merged = mergeVehicleSave(readTenantCollection<unknown>(id, "vehicles"), sent, new Set(deleted.ids));

    // The list first, then the pictures: if this stops in between, the
    // client never got its OK and sends the same deletedIds again, which
    // finishes the job.
    writeTenantCollection(id, "vehicles", merged);
    deleteVehiclePhotosFor(id, deleted.ids);
    res.json({ ok: true, items: merged });
  });
}
