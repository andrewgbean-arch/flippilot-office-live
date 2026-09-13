import { Express, Request } from "express";
import { readCollection } from "../db";
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
}
