import { Express, Request } from "express";
import { readCollection, writeCollection, deleteTenantData } from "../db";
import {
  requireAuth,
  requireOwner,
  requirePlatformAdmin,
  signInviteToken,
  type AuthUser,
  type Dealership,
  type StaffRole,
  type StoredUser,
} from "../auth";

const VALID_STAFF_ROLES: StaffRole[] = ["sales", "finance", "manager", "general"];

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
    const { name, phone, address, vatNumber } = req.body ?? {};

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
    if (vatNumber !== undefined) {
      const trimmed = String(vatNumber).trim();
      if (trimmed) dealership.vatNumber = trimmed;
      else delete dealership.vatNumber;
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
    const { inviteeName, staffRole } = req.body ?? {};
    const dealerships = readCollection<Dealership>("dealerships");
    const dealership = dealerships.find(d => d.id === user.dealershipId);

    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }

    const trimmedName = typeof inviteeName === "string" ? inviteeName.trim() : "";
    const resolvedStaffRole: StaffRole = VALID_STAFF_ROLES.includes(staffRole)
      ? staffRole
      : "general";

    const token = signInviteToken({
      dealershipId: dealership.id,
      dealershipName: dealership.name,
      role: "staff",
      staffRole: resolvedStaffRole,
      ...(trimmedName ? { inviteeName: trimmedName } : {}),
    });

    res.json({ ok: true, token });
  });

  // Cross-dealership admin tooling — same requirePlatformAdmin gate as
  // the Support Inbox, never reachable via anything a dealer-facing
  // flow touches. Lists every dealership so the admin can find (and,
  // below, remove) abandoned test/throwaway accounts before real
  // dealers are using this — also the real building block a future
  // GDPR-style "delete my account" request would need.
  app.get("/admin/dealerships", requireAuth, requirePlatformAdmin, (_req, res) => {
    const dealerships = readCollection<Dealership>("dealerships");
    const users = readCollection<StoredUser>("users");
    const items = dealerships.map(d => ({
      id: d.id,
      name: d.name,
      createdAt: d.createdAt,
      subscriptionStatus: d.subscriptionStatus,
      userCount: users.filter(u => u.dealershipId === d.id).length,
    }));
    res.json({ ok: true, dealerships: items });
  });

  // Real deletion, not a soft flag — removes the dealership record, every
  // user account under it, and every row of its tenant-scoped data
  // (vehicles/bookkeeping/consumables/everything) via deleteTenantData.
  // No undo: an admin action, not something a dealer can trigger on
  // their own account (that would need its own confirmation flow, not
  // built yet).
  app.delete("/admin/dealerships/:id", requireAuth, requirePlatformAdmin, (req, res) => {
    const dealershipId = req.params.id;
    if (!dealershipId) {
      return res.status(400).json({ ok: false, error: "Missing dealership id" });
    }
    const dealerships = readCollection<Dealership>("dealerships");
    const dealership = dealerships.find(d => d.id === dealershipId);
    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }

    writeCollection(
      "dealerships",
      dealerships.filter(d => d.id !== dealershipId)
    );
    writeCollection(
      "users",
      readCollection<StoredUser>("users").filter(u => u.dealershipId !== dealershipId)
    );
    deleteTenantData(dealershipId);

    res.json({ ok: true });
  });
}
