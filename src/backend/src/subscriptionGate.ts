import { Request, Response, NextFunction } from "express";
import { readCollection } from "./db";
import type { AuthUser, Dealership } from "./auth";

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
