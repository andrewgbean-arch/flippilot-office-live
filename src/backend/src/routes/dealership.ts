import { Express, Request } from "express";
import { readCollection, writeCollection } from "../db";
import { requireAuth, requireOwner, signInviteToken, type AuthUser, type Dealership } from "../auth";

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
  app.put("/dealership/me", requireAuth, requireOwner, (req, res) => {
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

  // Generates a shareable invite link (owner-only). There's no email
  // service configured for this app yet, so this hands back a raw link
  // for the owner to send themselves however they like, rather than
  // pretending to email it.
  app.post("/dealership/invite", requireAuth, requireOwner, (req, res) => {
    const user = (req as Request & { user: AuthUser }).user;
    const { inviteeName } = req.body ?? {};
    const dealerships = readCollection<Dealership>("dealerships");
    const dealership = dealerships.find(d => d.id === user.dealershipId);

    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }

    const trimmedName = typeof inviteeName === "string" ? inviteeName.trim() : "";

    const token = signInviteToken({
      dealershipId: dealership.id,
      dealershipName: dealership.name,
      role: "staff",
      ...(trimmedName ? { inviteeName: trimmedName } : {}),
    });

    res.json({ ok: true, token });
  });
}
