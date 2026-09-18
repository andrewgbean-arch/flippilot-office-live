import { Request, Response, NextFunction } from "express";
import { readCollection } from "./db";
import type { AuthUser, Dealership } from "./auth";

// Runs after requireAuth (needs req.user). Blocks a brand-new
// dealership that a platform admin hasn't vetted yet. Only an explicit
// "pending" blocks — a dealership with no approvalStatus at all
// (everything created before this gate existed) passes through
// untouched, so shipping this can't lock out a single existing account.
// Reads /dealership/me and /billing/* stay outside this gate on
// purpose (they only need requireAuth), so a pending dealer's own
// client can still fetch its real status and show "awaiting approval"
// rather than a dead-end error.
export function requireApprovedDealership(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user) {
    return res.status(401).json({ ok: false, error: "Not authenticated" });
  }

  const dealerships = readCollection<Dealership>("dealerships");
  const dealership = dealerships.find(d => d.id === user.dealershipId);

  if (!dealership) {
    return res.status(404).json({ ok: false, error: "Dealership not found" });
  }

  if (dealership.approvalStatus === "pending") {
    return res.status(403).json({
      ok: false,
      error: "Your dealership account is awaiting approval — you'll be able to use FlipPilot as soon as it's been reviewed.",
      approvalStatus: "pending",
    });
  }

  return next();
}

// Runs after requireAuth (needs req.user). Gates access once a
// dealership's trial has ended and it has no active paid subscription —
// this is what actually makes billing mean something, rather than just
// having a Stripe checkout button that doesn't gate anything.
export function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user) {
    return res.status(401).json({ ok: false, error: "Not authenticated" });
  }

  const dealerships = readCollection<Dealership>("dealerships");
  const dealership = dealerships.find(d => d.id === user.dealershipId);

  if (!dealership) {
    return res.status(404).json({ ok: false, error: "Dealership not found" });
  }

  const trialActive =
    dealership.subscriptionStatus === "trialing" &&
    new Date(dealership.trialEndsAt).getTime() > Date.now();

  if (dealership.subscriptionStatus === "active" || trialActive) {
    return next();
  }

  return res.status(402).json({
    ok: false,
    error: "Your trial has ended — subscribe to keep using FlipPilot Dealer OS.",
    subscriptionStatus: dealership.subscriptionStatus,
  });
}

// Pilot Brain is a real premium add-on, priced separately (see
// billing.ts) — a dealer on the core plan alone shouldn't reach it.
// Runs AFTER requireActiveSubscription, so trial/active status is
// already confirmed by the time this checks. During a real trial,
// Pilot Brain is included so a dealer can actually experience the
// premium feature before deciding whether to add it — the same
// reasoning as giving trial access to the rest of the product.
export function requirePilotBrainAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user) {
    return res.status(401).json({ ok: false, error: "Not authenticated" });
  }

  const dealerships = readCollection<Dealership>("dealerships");
  const dealership = dealerships.find(d => d.id === user.dealershipId);
  if (!dealership) {
    return res.status(404).json({ ok: false, error: "Dealership not found" });
  }

  const trialActive =
    dealership.subscriptionStatus === "trialing" &&
    new Date(dealership.trialEndsAt).getTime() > Date.now();

  if (trialActive || dealership.pilotBrainEnabled) {
    return next();
  }

  return res.status(402).json({
    ok: false,
    error: "Pilot Brain is a premium add-on — subscribe to it in Billing to keep using it.",
    pilotBrainEnabled: false,
  });
}
