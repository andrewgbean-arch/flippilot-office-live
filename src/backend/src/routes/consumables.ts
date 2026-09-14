import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";

export interface Consumable {
  id: string;
  name: string;
  supplierName?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  unit?: string;
  currentStock: number;
  reorderThreshold: number;
  notes?: string;
  updatedAt: string;
}

function authedUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// Consumables (screen wash, oil filters, valeting supplies etc.) — open
// to any authenticated staff to read/write, same trust tier as jobs.
// Whoever actually manages the stock cupboard day to day (often a
// cleaner or office admin, not necessarily an RBAC "manager") needs to
// be able to update it.
export default function registerConsumablesRoute(app: Express) {
  app.get("/consumables", (req, res) => {
    const user = authedUser(req);
    res.json({ ok: true, items: readTenantCollection<Consumable>(user.dealershipId, "consumables") });
  });

  app.put("/consumables", (req, res) => {
    const user = authedUser(req);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    writeTenantCollection(user.dealershipId, "consumables", items);
    res.json({ ok: true, items });
  });

  app.post("/consumables", (req, res) => {
    const user = authedUser(req);
    const { name, supplierName, supplierEmail, supplierPhone, unit, currentStock, reorderThreshold, notes } =
      req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ ok: false, error: "name is required" });
    }

    const items = readTenantCollection<Consumable>(user.dealershipId, "consumables");
    const entry: Consumable = {
      id: randomUUID(),
      name: name.trim(),
      ...(typeof supplierName === "string" && supplierName.trim() ? { supplierName: supplierName.trim() } : {}),
      ...(typeof supplierEmail === "string" && supplierEmail.trim() ? { supplierEmail: supplierEmail.trim() } : {}),
      ...(typeof supplierPhone === "string" && supplierPhone.trim() ? { supplierPhone: supplierPhone.trim() } : {}),
      ...(typeof unit === "string" && unit.trim() ? { unit: unit.trim() } : {}),
      currentStock: Number(currentStock) || 0,
      reorderThreshold: Number(reorderThreshold) || 0,
      ...(typeof notes === "string" && notes.trim() ? { notes: notes.trim() } : {}),
      updatedAt: new Date().toISOString(),
    };

    writeTenantCollection(user.dealershipId, "consumables", [...items, entry]);
    res.json({ ok: true, entry });
  });

  app.delete("/consumables/:id", (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<Consumable>(user.dealershipId, "consumables");
    writeTenantCollection(
      user.dealershipId,
      "consumables",
      items.filter((c) => c.id !== req.params.id)
    );
    res.json({ ok: true });
  });
}
