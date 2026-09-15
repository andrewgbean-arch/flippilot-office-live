import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";

export type ContactCategory =
  | "parts_supplier"
  | "auction_house"
  | "transport"
  | "valeting"
  | "other";

export interface Contact {
  id: string;
  name: string;
  category: ContactCategory;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  updatedAt: string;
}

function authedUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// Business contacts a dealer regularly deals with — parts suppliers,
// auction houses, transport/recovery, valeting — deliberately separate
// from Consumables' per-item supplier fields (those are free text tied
// to one stock item; this is the dealer's actual address book). Open
// to any authenticated staff to read/write, same trust tier as jobs/
// consumables — whoever's arranging a collection or ordering parts
// needs to be able to look up or add a contact without needing a
// manager-tier role.
export default function registerContactsRoute(app: Express) {
  app.get("/contacts", (req, res) => {
    const user = authedUser(req);
    res.json({ ok: true, items: readTenantCollection<Contact>(user.dealershipId, "contacts") });
  });

  app.put("/contacts", (req, res) => {
    const user = authedUser(req);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    writeTenantCollection(user.dealershipId, "contacts", items);
    res.json({ ok: true, items });
  });

  app.post("/contacts", (req, res) => {
    const user = authedUser(req);
    const { name, category, contactName, email, phone, address, notes } = req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ ok: false, error: "name is required" });
    }
    const validCategories: ContactCategory[] = ["parts_supplier", "auction_house", "transport", "valeting", "other"];
    const resolvedCategory: ContactCategory = validCategories.includes(category) ? category : "other";

    const items = readTenantCollection<Contact>(user.dealershipId, "contacts");
    const entry: Contact = {
      id: randomUUID(),
      name: name.trim(),
      category: resolvedCategory,
      ...(typeof contactName === "string" && contactName.trim() ? { contactName: contactName.trim() } : {}),
      ...(typeof email === "string" && email.trim() ? { email: email.trim() } : {}),
      ...(typeof phone === "string" && phone.trim() ? { phone: phone.trim() } : {}),
      ...(typeof address === "string" && address.trim() ? { address: address.trim() } : {}),
      ...(typeof notes === "string" && notes.trim() ? { notes: notes.trim() } : {}),
      updatedAt: new Date().toISOString(),
    };

    writeTenantCollection(user.dealershipId, "contacts", [...items, entry]);
    res.json({ ok: true, entry });
  });

  app.delete("/contacts/:id", (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<Contact>(user.dealershipId, "contacts");
    writeTenantCollection(
      user.dealershipId,
      "contacts",
      items.filter((c) => c.id !== req.params.id)
    );
    res.json({ ok: true });
  });
}
