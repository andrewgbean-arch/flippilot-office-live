import { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { readCollection, readTenantCollection, readTenantDoc, writeTenantDoc } from "../db";
import { requireStaffRole, type AuthUser, type Dealership } from "../auth";
import { isSampleVehicleId } from "../sampleVehicles";
import {
  DEFAULT_CONFIG,
  buildPublicPassport,
  normaliseConfig,
  parseConfigInput,
  suggestWorkDone,
  type PassportConfig,
} from "../engines/carPassport";

// Each car's passport settings live in their own document, keyed by car, NOT on
// the vehicle record. The stock list is saved as a whole by the screens that
// edit it, and a passport setting must never be lost (or a car quietly
// unpublished) because someone else saved the stock at the same moment.
const PASSPORTS_DOC = "carPassports";
type PassportDoc = Record<string, unknown>;

function readDoc(dealershipId: string): PassportDoc {
  const raw = readTenantDoc<unknown>(dealershipId, PASSPORTS_DOC, {});
  return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as PassportDoc) : {};
}

// Which cars have a published passport, for the public store page to link to.
export function publishedVehicleIds(dealershipId: string): Set<string> {
  const doc = readDoc(dealershipId);
  return new Set(Object.keys(doc).filter(id => normaliseConfig(doc[id]).published));
}

function authUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// The one public route here. Same reasoning as the other public reads (see
// publicBooking.ts): reachable by anyone with the link, so capped against a
// scraper, and generous enough that no real buyer ever notices.
const passportReadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests. Please try again shortly." },
});

const NOT_AVAILABLE = { ok: false, error: "This car page isn't available." };
const sane = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 100;

export default function registerCarPassportRoute(app: Express) {
  // The dealer's view of one car's passport: its settings, and lines that could
  // be added from what's already recorded against the car. (Behind the
  // app-level login gate, like every other dealer route.)
  app.get("/car-passports/:vehicleId", (req, res) => {
    const user = authUser(req);
    const vehicleId = req.params.vehicleId;
    if (!sane(vehicleId)) return res.status(404).json({ ok: false, error: "Car not found" });

    const vehicle = readTenantCollection<any>(user.dealershipId, "vehicles").find(v => v?.id === vehicleId);
    if (!vehicle) return res.status(404).json({ ok: false, error: "Car not found" });

    const bookkeeping = readTenantDoc<any>(user.dealershipId, "bookkeeping", {});
    const problem = publishProblem(vehicle);
    res.json({
      ok: true,
      config: normaliseConfig(readDoc(user.dealershipId)[vehicleId]),
      suggestions: suggestWorkDone(readTenantCollection<unknown>(user.dealershipId, "jobs"), bookkeeping?.costs, vehicleId),
      canPublish: problem === null,
      ...(problem ? { cannotPublishBecause: problem } : {}),
    });
  });

  // Publishing puts a car on the open internet, so it is for the people who sell
  // cars: sales, managers and the owner. Finance and general staff can look but
  // not publish.
  app.put("/car-passports/:vehicleId", requireStaffRole("sales", "manager"), (req, res) => {
    const user = authUser(req);
    const vehicleId = req.params.vehicleId;
    if (!sane(vehicleId)) return res.status(404).json({ ok: false, error: "Car not found" });

    const vehicle = readTenantCollection<any>(user.dealershipId, "vehicles").find(v => v?.id === vehicleId);
    if (!vehicle) return res.status(404).json({ ok: false, error: "Car not found" });

    const parsed = parseConfigInput(req.body);
    if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });

    if (parsed.config.published) {
      const problem = publishProblem(vehicle);
      if (problem) return res.status(400).json({ ok: false, error: problem });
    }

    const config: PassportConfig = { ...parsed.config, updatedAt: new Date().toISOString() };
    // Read and write in the same step (nothing awaits in between), so two
    // people editing different cars can't overwrite each other.
    const doc = readDoc(user.dealershipId);
    const untouched = !config.published && sameAsDefault(config);
    const next: PassportDoc = { ...doc };
    if (untouched) delete next[vehicleId];
    else next[vehicleId] = config;
    writeTenantDoc(user.dealershipId, PASSPORTS_DOC, next);

    res.json({ ok: true, config });
  });

  // The page a buyer opens. No login. Every reason a car isn't available (no
  // such dealership, no such car, a demo car, not published) gets the same
  // answer, so it can't be used to find out which cars exist.
  app.get("/public/:dealershipId/cars/:vehicleId", passportReadLimiter, (req, res) => {
    const { dealershipId, vehicleId } = req.params;
    if (!sane(dealershipId) || !sane(vehicleId)) return res.status(404).json(NOT_AVAILABLE);

    const dealership = readCollection<Dealership>("dealerships").find(d => d.id === dealershipId);
    if (!dealership || isSampleVehicleId(vehicleId)) return res.status(404).json(NOT_AVAILABLE);

    const vehicle = readTenantCollection<any>(dealershipId, "vehicles").find(v => v?.id === vehicleId);
    if (!vehicle) return res.status(404).json(NOT_AVAILABLE);

    const config = normaliseConfig(readDoc(dealershipId)[vehicleId]);
    if (!config.published) return res.status(404).json(NOT_AVAILABLE);

    // Availability is live, so this is never cached.
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      ...buildPublicPassport({
        dealership,
        vehicle,
        config,
        snapshots: config.showMarket ? readCollection<unknown>("marketSnapshots") : [],
        now: Date.now(),
      }),
    });
  });
}

// Why a car can't be put on a public page, or null if it can.
function publishProblem(vehicle: any): string | null {
  if (isSampleVehicleId(String(vehicle?.id ?? ""))) return "Demo cars can't be published.";
  if (!String(vehicle?.make ?? "").trim() || !String(vehicle?.model ?? "").trim()) return "Add the make and model first.";
  return null;
}

function sameAsDefault(c: PassportConfig): boolean {
  return (
    c.showReg === DEFAULT_CONFIG.showReg &&
    c.showMot === DEFAULT_CONFIG.showMot &&
    c.showUlez === DEFAULT_CONFIG.showUlez &&
    c.showMarket === DEFAULT_CONFIG.showMarket &&
    c.workDone.length === 0 &&
    c.note === ""
  );
}
