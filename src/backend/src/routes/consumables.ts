import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";

export interface StockMovement {
  id: string;
  type: "receive" | "adjust";
  quantity: number; // signed delta actually applied to currentStock
  date: string; // when the stock actually arrived/was corrected, not necessarily now
  cost?: number;
  supplier?: string;
  note?: string;
  createdAt: string;
  createdBy?: string;
}

export interface Consumable {
  id: string;
  name: string;
  partNumber?: string;
  description?: string;
  supplierName?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  unit?: string;
  currentStock: number;
  reorderThreshold: number;
  notes?: string;
  movements?: StockMovement[];
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
    const { name, partNumber, description, supplierName, supplierEmail, supplierPhone, unit, currentStock, reorderThreshold, notes } =
      req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ ok: false, error: "name is required" });
    }

    const items = readTenantCollection<Consumable>(user.dealershipId, "consumables");
    const entry: Consumable = {
      id: randomUUID(),
      name: name.trim(),
      ...(typeof partNumber === "string" && partNumber.trim() ? { partNumber: partNumber.trim() } : {}),
      ...(typeof description === "string" && description.trim() ? { description: description.trim() } : {}),
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

  // A stock delivery or a manual count correction — recorded as its own
  // audited movement rather than letting currentStock be silently
  // overwritten, so a dealer can later answer "where did this number
  // come from" instead of just seeing the latest total.
  app.post("/consumables/:id/movements", (req, res) => {
    const user = authedUser(req);
    const { type, quantity, date, cost, supplier, note } = req.body ?? {};

    if (type !== "receive" && type !== "adjust") {
      return res.status(400).json({ ok: false, error: "type must be 'receive' or 'adjust'" });
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty === 0) {
      return res.status(400).json({ ok: false, error: "quantity must be a nonzero number" });
    }
    if (type === "receive" && qty < 0) {
      return res.status(400).json({ ok: false, error: "receive quantity must be positive" });
    }

    const items = readTenantCollection<Consumable>(user.dealershipId, "consumables");
    const item = items.find((c) => c.id === req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: "Consumable not found" });

    const movement: StockMovement = {
      id: randomUUID(),
      type,
      quantity: qty,
      date: typeof date === "string" && date ? date : new Date().toISOString().slice(0, 10),
      ...(typeof cost === "number" && cost > 0 ? { cost } : {}),
      ...(typeof supplier === "string" && supplier.trim() ? { supplier: supplier.trim() } : {}),
      ...(typeof note === "string" && note.trim() ? { note: note.trim() } : {}),
      createdAt: new Date().toISOString(),
      ...(user.name ? { createdBy: user.name } : {}),
    };

    const updated: Consumable = {
      ...item,
      currentStock: Math.max(0, item.currentStock + qty),
      movements: [...(item.movements ?? []), movement],
      updatedAt: new Date().toISOString(),
    };

    writeTenantCollection(
      user.dealershipId,
      "consumables",
      items.map((c) => (c.id === updated.id ? updated : c))
    );
    res.json({ ok: true, item: updated });
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
