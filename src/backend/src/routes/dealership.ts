import { Express, Request } from "express";
import { readCollection, writeCollection, deleteTenantData } from "../db";
import { trialEndsAtFrom } from "../trial";
import {
  requireAuth,
  requireOwner,
  requirePlatformAdmin,
  signInviteToken,
  VALID_STAFF_ROLES,
  type AuthUser,
  type Dealership,
  type StaffRole,
  type StoredUser,
} from "../auth";

// What a signed-in teammate (anyone who is not the owner) may read about the
// dealership at GET /dealership/me. The stored record also holds the Stripe
// customer and subscription ids (billing identifiers no teammate has any use
// for) and inviteEpoch (the counter behind cancelling shared invite links). The
// owner gets the whole record; everyone else gets only what the app reads. The
// list comes from the callers, not from guessing:
//   id, name, phone, address, vatNumber - DealerContext: the dealership's name
//        and contact/VAT details, shown on invoices and the public page
//   subscriptionStatus, trialEndsAt     - TrialBanner and BillingScreen: the
//        trial and subscription messages
//   pilotBrainEnabled                   - BillingScreen: the Pilot Brain line
//   approvalStatus                      - nothing on the web reads it from here
//        (login and /auth/me carry it), but this route is deliberately open to a
//        dealership still awaiting approval so a client can show its real status
//        (see app.ts), and it is not sensitive
// The phone companion app reads `name` only. dealershipMeFields.test.ts checks
// this list against the callers' source, so the two cannot drift silently.
export const TEAMMATE_DEALERSHIP_FIELDS = [
  "id",
  "name",
  "phone",
  "address",
  "vatNumber",
  "subscriptionStatus",
  "trialEndsAt",
  "pilotBrainEnabled",
  "approvalStatus",
] as const satisfies readonly (keyof Dealership)[];

// The owner's view is the stored record itself; anyone else's is only the
// whitelisted fields the record actually has (an unset field stays absent,
// exactly as it is in the owner's copy).
export function dealershipViewFor(user: Pick<AuthUser, "role">, dealership: Dealership): Partial<Dealership> {
  if (user.role === "owner") return dealership;
  const view: Record<string, unknown> = {};
  for (const field of TEAMMATE_DEALERSHIP_FIELDS) {
    if (dealership[field] !== undefined) view[field] = dealership[field];
  }
  return view as Partial<Dealership>;
}

export default function registerDealershipRoute(app: Express) {
  app.get("/dealership/me", requireAuth, (req, res) => {
    const user = (req as Request & { user: AuthUser }).user;
    const dealerships = readCollection<Dealership>("dealerships");
    const dealership = dealerships.find(d => d.id === user.dealershipId);

    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }

    res.json({ ok: true, dealership: dealershipViewFor(user, dealership) });
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
  // pretending to email it. Anyone holding the link can use it, more than
  // once, for its 7-day life, with the role chosen here — it is not tied to
  // an email address. Removing a teammate (or moving one to a lower role)
  // cancels every link shared before that moment; see team.ts.
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
      // Stamped with the dealership's current generation of links, so
      // that a later removal (or demotion) can cancel this one along with
      // every other link already out there — see Dealership.inviteEpoch.
      inviteEpoch: dealership.inviteEpoch ?? 0,
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
      // A dealership with no approvalStatus at all predates the gate
      // and is treated as approved, same as requireApprovedDealership.
      approvalStatus: d.approvalStatus ?? "approved",
      userCount: users.filter(u => u.dealershipId === d.id).length,
    }));
    res.json({ ok: true, dealerships: items });
  });

  // Manual vetting of a brand-new dealership signup — the only way a
  // "pending" dealership becomes usable. Platform-admin-only, same gate
  // as the list/delete routes around it.
  app.post("/admin/dealerships/:id/approve", requireAuth, requirePlatformAdmin, (req, res) => {
    const dealershipId = req.params.id;
    const dealerships = readCollection<Dealership>("dealerships");
    const dealership = dealerships.find(d => d.id === dealershipId);
    if (!dealership) {
      return res.status(404).json({ ok: false, error: "Dealership not found" });
    }

    const wasPending = dealership.approvalStatus === "pending";
    dealership.approvalStatus = "approved";
    // The 14 free days start when the dealership can actually use the app, not at
    // sign-up: otherwise a slow review would eat into the trial they were promised.
    // Only a pending dealership that is still on its trial is touched, so approving
    // twice, or an account that has already subscribed, keeps whatever it had.
    if (wasPending && dealership.subscriptionStatus === "trialing") {
      dealership.trialEndsAt = trialEndsAtFrom(new Date());
    }
    writeCollection("dealerships", dealerships);
    res.json({ ok: true, dealership: { id: dealership.id, name: dealership.name, approvalStatus: dealership.approvalStatus } });
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
