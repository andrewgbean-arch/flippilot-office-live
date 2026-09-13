import { Express, Request } from "express";
import { readCollection, writeCollection } from "../db";
import { requireAuth, type AuthUser, type Dealership } from "../auth";

export default function registerDealershipRoute(app: Express) {
  app.get("/dealership/me", requireAuth, (req, res) => {
    const user = (req as Request & { user: AuthUser }).user;
    const dealerships = readCollection<Dealership>("dealerships");
    const dealership = dealerships.find(d => d.id === user.dealershipId);

    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }

    res.json({ ok: true, dealership });
  });

  // Lets the "Edit Dealer Profile" screen actually save something — it
  // previously had no backing endpoint at all, just a button with no
  // onClick. Only name/phone/address are editable here; billing/
  // subscription fields stay untouched regardless of what's posted.
  app.put("/dealership/me", requireAuth, (req, res) => {
    const user = (req as Request & { user: AuthUser }).user;
    const { name, phone, address } = req.body ?? {};

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ ok: false, error: "Dealership name can't be empty" });
    }

    const dealerships = readCollection<Dealership>("dealerships");
    const dealership = dealerships.find(d => d.id === user.dealershipId);

    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }

    if (name !== undefined) dealership.name = String(name).trim();
    if (phone !== undefined) {
      const trimmed = String(phone).trim();
      if (trimmed) dealership.phone = trimmed;
      else delete dealership.phone;
    }
    if (address !== undefined) {
      const trimmed = String(address).trim();
      if (trimmed) dealership.address = trimmed;
      else delete dealership.address;
    }

    writeCollection("dealerships", dealerships);
    res.json({ ok: true, dealership });
  });
}
